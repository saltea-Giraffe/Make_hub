import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import db from '../db/connection';
import { requireAuth } from '../middleware/auth';
import { OIDC, SAML, isOidcConfigured, isSamlConfigured } from '../config';
import { issueToken } from '../auth/ssoUsers';
import oidcRouter from '../auth/oidc';
import samlRouter from '../auth/saml';
import type { User } from '../types';

const router = Router();

const SALT_ROUNDS = 10;

/** ユーザーが1人も登録されていない = 初回セットアップが必要 */
function needsSetup(): boolean {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  return n === 0;
}

function firstError(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, error: errors.array()[0].msg });
    return true;
  }
  return false;
}

/** ログインレスポンスに載せる公開ユーザー情報 */
function publicUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    display_name: user.display_name,
    avatar_type: user.avatar_type,
    avatar_value: user.avatar_value,
    auth_provider: user.auth_provider,
  };
}

// ─── GET /api/auth/setup-status ───────────────────────────────────
// 初回セットアップが必要かどうか。フロントエンドの初期表示判定に使う。
router.get('/setup-status', (_req: Request, res: Response) => {
  res.json({ success: true, data: { needs_setup: needsSetup() } });
});

// ─── POST /api/auth/setup ─────────────────────────────────────────
// 最初の管理者アカウントを作成する。ユーザーが1人でも居る場合は拒否する。
router.post(
  '/setup',
  [
    body('username')
      .trim().notEmpty().withMessage('ユーザー名は必須です')
      .isLength({ min: 3, max: 50 }).withMessage('ユーザー名は3〜50文字で入力してください')
      .matches(/^[a-zA-Z0-9_-]+$/).withMessage('ユーザー名は半角英数字・アンダースコア・ハイフンのみ使用できます'),
    body('password')
      .notEmpty().withMessage('パスワードは必須です')
      .isLength({ min: 8 }).withMessage('管理者パスワードは8文字以上で入力してください'),
    body('confirm_password').notEmpty().withMessage('確認用パスワードは必須です'),
    body('display_name').optional({ nullable: true }).trim().isLength({ max: 50 }),
  ],
  async (req: Request, res: Response) => {
    if (firstError(req, res)) return;

    const { username, password, confirm_password, display_name } = req.body as {
      username: string; password: string; confirm_password: string; display_name?: string | null;
    };

    if (password !== confirm_password) {
      res.status(422).json({ success: false, error: 'パスワードと確認用パスワードが一致しません' });
      return;
    }

    if (!needsSetup()) {
      res.status(409).json({
        success: false,
        error: 'セットアップは既に完了しています。ログイン画面からログインしてください。',
      });
      return;
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    // 件数確認と INSERT を同一トランザクションで行い、二重セットアップを防ぐ
    let newId: number;
    try {
      newId = db.transaction(() => {
        const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
        if (n > 0) throw new Error('ALREADY_SETUP');
        const result = db.prepare(`
          INSERT INTO users (username, password_hash, role, display_name, auth_provider)
          VALUES (?, ?, 'admin', ?, 'local')
        `).run(username, hash, display_name?.trim() || null);
        return Number(result.lastInsertRowid);
      })();
    } catch (err) {
      if (err instanceof Error && err.message === 'ALREADY_SETUP') {
        res.status(409).json({ success: false, error: 'セットアップは既に完了しています。' });
        return;
      }
      throw err;
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(newId) as User;
    console.log(`👤 初回セットアップ: 管理者 "${username}" を作成しました`);

    res.status(201).json({
      success: true,
      data: { token: issueToken(user), user: publicUser(user) },
      message: '管理者アカウントを作成しました',
    });
  }
);

// ─── GET /api/auth/providers ──────────────────────────────────────
// ログイン画面に出す認証手段の一覧
router.get('/providers', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      local: true,
      oidc: isOidcConfigured() ? { label: OIDC.label, url: '/api/auth/oidc/login' } : null,
      saml: isSamlConfigured() ? { label: SAML.label, url: '/api/auth/saml/login' } : null,
    },
  });
});

// ─── POST /api/auth/login ──────────────────────────────────────────
router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('ユーザー名は必須です'),
    body('password').notEmpty().withMessage('パスワードは必須です'),
  ],
  async (req: Request, res: Response) => {
    if (firstError(req, res)) return;

    const { username, password } = req.body as { username: string; password: string };

    const user = db.prepare(
      'SELECT * FROM users WHERE username = ? AND is_active = 1'
    ).get(username) as User | undefined;

    // SSO 専用アカウントはパスワードを持たない。
    // パスワード照合を試みずに弾く（bcrypt に null を渡さないため）。
    if (user && !user.password_hash) {
      res.status(401).json({
        success: false,
        error: 'このアカウントは SSO 専用です。SSO ボタンからログインしてください。',
      });
      return;
    }

    // ユーザーが存在しない場合でも同じエラーを返す（ユーザー名の存在有無を隠す）
    const isValid = user ? await bcrypt.compare(password, user.password_hash!) : false;
    if (!user || !isValid) {
      res.status(401).json({ success: false, error: 'ユーザー名またはパスワードが正しくありません' });
      return;
    }

    // 最終ログイン日時を更新
    db.prepare("UPDATE users SET last_login_at = datetime('now', 'localtime') WHERE id = ?").run(user.id);

    res.json({
      success: true,
      data: { token: issueToken(user), user: publicUser(user) },
      message: 'ログインしました',
    });
  }
);

// ─── POST /api/auth/register ──────────────────────────────────────
// 誰でもアクセス可能な自己登録エンドポイント。ロールは常に 'user'。
router.post(
  '/register',
  [
    body('username')
      .trim().notEmpty().withMessage('ユーザー名は必須です')
      .isLength({ min: 3, max: 50 }).withMessage('ユーザー名は3〜50文字で入力してください')
      .matches(/^[a-zA-Z0-9_-]+$/).withMessage('ユーザー名は半角英数字・アンダースコア・ハイフンのみ使用できます'),
    body('password')
      .notEmpty().withMessage('パスワードは必須です')
      .isLength({ min: 6 }).withMessage('パスワードは6文字以上で入力してください'),
    body('confirm_password')
      .notEmpty().withMessage('確認用パスワードは必須です'),
  ],
  async (req: Request, res: Response) => {
    if (firstError(req, res)) return;

    const { username, password, confirm_password } = req.body as {
      username: string; password: string; confirm_password: string;
    };

    if (password !== confirm_password) {
      res.status(422).json({ success: false, error: 'パスワードと確認用パスワードが一致しません' });
      return;
    }

    // 管理者不在の状態で一般ユーザーを作らせない（初回はセットアップ画面を通す）
    if (needsSetup()) {
      res.status(409).json({
        success: false,
        error: 'まだ初期セットアップが完了していません。最初に管理者アカウントを作成してください。',
      });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      res.status(409).json({ success: false, error: 'このユーザー名はすでに使用されています' });
      return;
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = db.prepare(
      "INSERT INTO users (username, password_hash, role, auth_provider) VALUES (?, ?, 'user', 'local')"
    ).run(username, hash);

    const user = db.prepare('SELECT * FROM users WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as User;

    res.status(201).json({
      success: true,
      data: { token: issueToken(user), user: publicUser(user) },
      message: 'アカウントを作成しました',
    });
  }
);

// ─── GET /api/auth/me ─────────────────────────────────────────────
// トークン検証 + 現在のユーザー情報を返す（フロントエンドの認証状態復元に使用）
router.get('/me', requireAuth, (req: Request, res: Response) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as User | undefined;

  if (!user || !user.is_active) {
    res.status(401).json({ success: false, error: 'ユーザーが無効です' });
    return;
  }

  res.json({ success: true, data: publicUser(user) });
});

// ─── SSO ルート ────────────────────────────────────────────────────
router.use('/oidc', oidcRouter);
router.use('/saml', samlRouter);

export default router;
