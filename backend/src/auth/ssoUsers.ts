import jwt from 'jsonwebtoken';
import db from '../db/connection';
import { JWT_SECRET, JWT_EXPIRES, SSO_DEFAULT_ROLE, SSO_SUCCESS_REDIRECT } from '../config';
import type { AuthPayload } from '../middleware/auth';
import type { User } from '../types';

/** IdP から受け取ったユーザー情報を正規化したもの */
export interface SsoProfile {
  provider: 'oidc' | 'saml';
  /** IdP 内で不変のユーザー識別子（OIDC の sub / SAML の NameID など） */
  externalId: string;
  /** 希望するユーザー名。衝突する場合は自動で調整される */
  username: string;
  displayName?: string | null;
  email?: string | null;
  /** IdP 側の属性から管理者と判定された場合 true */
  isAdmin?: boolean;
}

export class SsoError extends Error {}

/** ユーザー名として使える文字だけを残す */
function sanitizeUsername(raw: string): string {
  const cleaned = (raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_.-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 50);
  return cleaned.length >= 3 ? cleaned : `sso-${cleaned}`.slice(0, 50);
}

/** 既存ユーザーと衝突しないユーザー名を作る */
function uniqueUsername(base: string): string {
  const exists = db.prepare('SELECT id FROM users WHERE username = ?');
  if (!exists.get(base)) return base;

  for (let i = 2; i < 1000; i++) {
    const suffix = `-${i}`;
    const candidate = base.slice(0, 50 - suffix.length) + suffix;
    if (!exists.get(candidate)) return candidate;
  }
  throw new SsoError('ユーザー名を決定できませんでした');
}

/**
 * SSO プロフィールに対応するローカルユーザーを取得し、無ければ作成する。
 *
 * - 同一 (プロバイダ, 外部ID) のユーザーが居ればそれを再利用する
 * - システム最初のユーザーになる場合は、管理者不在を避けるため必ず admin にする
 */
export function upsertSsoUser(profile: SsoProfile): User {
  if (!profile.externalId) {
    throw new SsoError('IdP からユーザー識別子を取得できませんでした');
  }

  const existing = db.prepare(
    'SELECT * FROM users WHERE auth_provider = ? AND external_id = ?'
  ).get(profile.provider, profile.externalId) as User | undefined;

  if (existing) {
    if (!existing.is_active) {
      throw new SsoError('このアカウントは無効化されています。管理者にお問い合わせください。');
    }
    // IdP 側で表示名・メールが変わっていれば追随する（ロールは管理画面の設定を尊重して上書きしない）
    db.prepare(`
      UPDATE users
         SET display_name  = COALESCE(?, display_name),
             email         = COALESCE(?, email),
             last_login_at = datetime('now', 'localtime')
       WHERE id = ?
    `).run(profile.displayName ?? null, profile.email ?? null, existing.id);

    return db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id) as User;
  }

  // ─── 新規作成 ───────────────────────────────────────────────
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  const isFirstUser = n === 0;
  const role: 'admin' | 'user' =
    isFirstUser || profile.isAdmin ? 'admin' : SSO_DEFAULT_ROLE;

  const username = uniqueUsername(sanitizeUsername(profile.username || profile.externalId));

  const result = db.prepare(`
    INSERT INTO users
      (username, password_hash, role, is_active, display_name, email, auth_provider, external_id, last_login_at)
    VALUES (?, NULL, ?, 1, ?, ?, ?, ?, datetime('now', 'localtime'))
  `).run(
    username,
    role,
    profile.displayName ?? null,
    profile.email ?? null,
    profile.provider,
    profile.externalId
  );

  if (isFirstUser) {
    console.log(`👤 SSO で最初のユーザーを作成したため管理者にしました: ${username}`);
  }

  return db.prepare('SELECT * FROM users WHERE id = ?').get(Number(result.lastInsertRowid)) as User;
}

/** ログイン済みユーザーに対する JWT を発行する */
export function issueToken(user: Pick<User, 'id' | 'username' | 'role'>): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role } satisfies AuthPayload,
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES } as jwt.SignOptions
  );
}

/**
 * SSO 成功後のリダイレクト先を組み立てる。
 *
 * トークンはクエリ文字列ではなくフラグメント(#)に載せる。
 * フラグメントはサーバーに送信されずアクセスログや Referer に残らないため。
 */
export function buildSuccessRedirect(token: string): string {
  const sep = SSO_SUCCESS_REDIRECT.includes('#') ? '&' : '#';
  return `${SSO_SUCCESS_REDIRECT}${sep}token=${encodeURIComponent(token)}`;
}

/** SSO 失敗時のリダイレクト先（ログイン画面にエラーを表示させる） */
export function buildFailureRedirect(message: string): string {
  return `/login?sso_error=${encodeURIComponent(message)}`;
}
