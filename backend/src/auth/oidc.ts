import { Router, Request, Response } from 'express';
import { Issuer, generators, type Client } from 'openid-client';
import { OIDC, PUBLIC_URL, isOidcConfigured } from '../config';
import {
  upsertSsoUser, issueToken, buildSuccessRedirect, buildFailureRedirect,
  SsoError, type SsoProfile,
} from './ssoUsers';

const router = Router();

/** 認可リクエスト1件ぶんの一時状態（10分でタイムアウト） */
interface PendingLogin {
  nonce: string;
  codeVerifier: string;
  expiresAt: number;
}

const STATE_TTL_MS = 10 * 60 * 1000;
const pending = new Map<string, PendingLogin>();

function rememberState(state: string, value: Omit<PendingLogin, 'expiresAt'>): void {
  // 期限切れのエントリを掃除してから追加する（専用タイマーを持たない）
  const now = Date.now();
  for (const [k, v] of pending) {
    if (v.expiresAt <= now) pending.delete(k);
  }
  pending.set(state, { ...value, expiresAt: now + STATE_TTL_MS });
}

function takeState(state: string | undefined): PendingLogin | undefined {
  if (!state) return undefined;
  const entry = pending.get(state);
  // 一度使った state は必ず破棄する（リプレイ防止）
  pending.delete(state);
  if (!entry || entry.expiresAt <= Date.now()) return undefined;
  return entry;
}

/** リダイレクトURI。明示設定が無ければ PUBLIC_URL から組み立てる */
function redirectUri(): string {
  if (OIDC.redirectUri) return OIDC.redirectUri;
  if (!PUBLIC_URL) {
    throw new SsoError(
      'OIDC を使うには PUBLIC_URL か OIDC_REDIRECT_URI を .env に設定してください'
    );
  }
  return `${PUBLIC_URL}/api/auth/oidc/callback`;
}

// ディスカバリ結果は使い回す（失敗した場合は次回再試行できるようリセットする）
let clientPromise: Promise<Client> | null = null;

function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const issuer = await Issuer.discover(OIDC.issuer!);
      return new issuer.Client({
        client_id: OIDC.clientId!,
        client_secret: OIDC.clientSecret!,
        redirect_uris: [redirectUri()],
        response_types: ['code'],
      });
    })().catch(err => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

/** クレーム値（文字列 / 配列 / スペース区切り）に目的の値が含まれるか */
function claimContains(value: unknown, expected: string): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.map(String).includes(expected);
  const s = String(value);
  return s === expected || s.split(/[\s,]+/).includes(expected);
}

function toProfile(claims: Record<string, unknown>): SsoProfile {
  const sub = String(claims.sub ?? '');
  const email = typeof claims.email === 'string' ? claims.email : null;

  const preferred = claims[OIDC.usernameClaim];
  const username =
    (typeof preferred === 'string' && preferred) ||
    (email ? email.split('@')[0] : '') ||
    sub;

  const displayName =
    (typeof claims.name === 'string' && claims.name) ||
    (typeof claims.preferred_username === 'string' && claims.preferred_username) ||
    null;

  const isAdmin =
    !!OIDC.adminClaim && !!OIDC.adminValue &&
    claimContains(claims[OIDC.adminClaim], OIDC.adminValue);

  return { provider: 'oidc', externalId: sub, username, displayName, email, isAdmin };
}

// ─── GET /api/auth/oidc/login ─────────────────────────────────────
router.get('/login', async (_req: Request, res: Response) => {
  if (!isOidcConfigured()) {
    res.redirect(buildFailureRedirect('OIDC は設定されていません'));
    return;
  }

  try {
    const client = await getClient();
    const state = generators.state();
    const nonce = generators.nonce();
    const codeVerifier = generators.codeVerifier();

    rememberState(state, { nonce, codeVerifier });

    const url = client.authorizationUrl({
      scope: OIDC.scope,
      state,
      nonce,
      code_challenge: generators.codeChallenge(codeVerifier),
      code_challenge_method: 'S256',
      redirect_uri: redirectUri(),
    });
    res.redirect(url);
  } catch (err) {
    console.error('[OIDC] 認可リクエストの生成に失敗:', err);
    res.redirect(buildFailureRedirect('OIDC の設定に問題があります。管理者にお問い合わせください。'));
  }
});

// ─── GET /api/auth/oidc/callback ──────────────────────────────────
router.get('/callback', async (req: Request, res: Response) => {
  if (!isOidcConfigured()) {
    res.redirect(buildFailureRedirect('OIDC は設定されていません'));
    return;
  }

  try {
    const client = await getClient();
    const params = client.callbackParams(req);

    // IdP がエラーを返してきた場合
    if (params.error) {
      const detail = params.error_description || params.error;
      res.redirect(buildFailureRedirect(`IdP がログインを拒否しました: ${detail}`));
      return;
    }

    const saved = takeState(params.state);
    if (!saved) {
      res.redirect(buildFailureRedirect('ログインの有効期限が切れました。もう一度お試しください。'));
      return;
    }

    // ここで ID トークンの署名・iss・aud・nonce がすべて検証される
    const tokenSet = await client.callback(redirectUri(), params, {
      state: params.state,
      nonce: saved.nonce,
      code_verifier: saved.codeVerifier,
    });

    const user = upsertSsoUser(toProfile(tokenSet.claims() as Record<string, unknown>));
    res.redirect(buildSuccessRedirect(issueToken(user)));
  } catch (err) {
    const message = err instanceof SsoError
      ? err.message
      : 'SSO ログインに失敗しました。管理者にお問い合わせください。';
    if (!(err instanceof SsoError)) console.error('[OIDC] コールバック処理に失敗:', err);
    res.redirect(buildFailureRedirect(message));
  }
});

export default router;
