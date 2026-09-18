import crypto from 'crypto';

/**
 * アプリ全体の設定を一元管理する。
 *
 * セキュリティ要件:
 *  - シークレットをソースコードにハードコードしない。
 *  - 本番(NODE_ENV=production)で JWT_SECRET が未設定／安全でない既定値の場合は
 *    黙って弱い値を使わず、起動を中止する(fail-fast)。
 *  - 開発環境では利便性のため、未設定なら起動ごとにランダムな一時値を使う。
 */

// 過去にソースへハードコードされていた既定値。公開済みのため安全でない値として拒否する。
const INSECURE_SECRETS = new Set(['change-this-secret-in-production', '']);

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!secret || INSECURE_SECRETS.has(secret)) {
    if (isProduction) {
      throw new Error(
        '[FATAL] JWT_SECRET が未設定、または安全でない既定値のままです。' +
        '.env に十分に長いランダム値（推奨: 64文字以上の16進）を設定してから再起動してください。'
      );
    }
    // 開発環境: 起動は許可するが、再起動ごとに変わる一時シークレットを使う。
    // （発行済みトークンはサーバー再起動で無効になる）
    console.warn(
      '[警告] JWT_SECRET が未設定です。開発用の一時シークレットを生成しました。' +
      'サーバーを再起動すると発行済みトークンは無効になります。'
    );
    return crypto.randomBytes(48).toString('hex');
  }

  if (secret.length < 32) {
    console.warn(
      `[警告] JWT_SECRET が短すぎます（${secret.length}文字）。` +
      '推測耐性のため 32 文字以上のランダム値を強く推奨します。'
    );
  }

  return secret;
}

/** 署名・検証に使う JWT シークレット（必ずこのモジュール経由で参照する） */
export const JWT_SECRET = resolveJwtSecret();

/** JWT トークンの有効期限 */
export const JWT_EXPIRES = process.env.JWT_EXPIRES ?? '8h';

// ─── 共通ヘルパー ──────────────────────────────────────────────────

/** "true" / "1" / "yes" / "on" を真とみなす（未設定は fallback） */
function envBool(name: string, fallback = false): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  if (v === undefined || v === '') return fallback;
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isInteger(v) && v > 0 ? v : fallback;
}

function envStr(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

// ─── サーバー ──────────────────────────────────────────────────────

export const PORT = envInt('PORT', 3001);

/**
 * 外部から見たこのサーバーのベースURL。
 * SSO のコールバックURL組み立てに使うため、SSO を使う場合は必ず設定する。
 * 例: https://hub.example.com  /  https://192.168.1.10:3443
 */
export const PUBLIC_URL = envStr('PUBLIC_URL')?.replace(/\/+$/, '');

// ─── HTTPS ────────────────────────────────────────────────────────

export const HTTPS = {
  /** HTTPS を有効にするか */
  enabled: envBool('HTTPS_ENABLED', false),
  /** HTTPS の待ち受けポート */
  port: envInt('HTTPS_PORT', 3443),
  /** 証明書ファイル（未指定なら自己署名証明書を自動生成） */
  certFile: envStr('HTTPS_CERT_FILE'),
  keyFile:  envStr('HTTPS_KEY_FILE'),
  /** 中間証明書チェーン（任意） */
  caFile:   envStr('HTTPS_CA_FILE'),
  /**
   * true のとき HTTP(:PORT) は HTTPS(:HTTPS_PORT) への 301 リダイレクトのみを行う。
   * false のときは HTTP と HTTPS の両方でアプリを提供する。
   */
  redirectHttp: envBool('HTTPS_REDIRECT', true),
  /** 自己署名証明書に追加で入れるホスト名（カンマ区切り） */
  extraHosts: (envStr('HTTPS_EXTRA_HOSTS') ?? '')
    .split(',').map(s => s.trim()).filter(Boolean),
  /**
   * HSTS ヘッダを送るか。既定は false。
   * 自己署名証明書や、後から HTTP に戻す可能性のある環境で有効にすると、
   * ブラウザがそのホストへの HTTP 接続を一定期間拒否するようになるため。
   * 正規の証明書で恒久的に HTTPS 運用する場合のみ true にする。
   */
  hsts: envBool('HTTPS_HSTS', false),
} as const;

// ─── OIDC (OpenID Connect) ────────────────────────────────────────

export const OIDC = {
  enabled: envBool('OIDC_ENABLED', false),
  /** 例: https://accounts.google.com （末尾スラッシュなし） */
  issuer:       envStr('OIDC_ISSUER'),
  clientId:     envStr('OIDC_CLIENT_ID'),
  clientSecret: envStr('OIDC_CLIENT_SECRET'),
  /** 未指定なら PUBLIC_URL + /api/auth/oidc/callback を使う */
  redirectUri:  envStr('OIDC_REDIRECT_URI'),
  scope:        envStr('OIDC_SCOPE') ?? 'openid profile email',
  /** ログインボタンに出す表示名 */
  label:        envStr('OIDC_LABEL') ?? 'SSO でログイン',
  /** ユーザー名として使う ID トークンのクレーム */
  usernameClaim: envStr('OIDC_USERNAME_CLAIM') ?? 'preferred_username',
  /** このクレームに含まれる値を持つユーザーを管理者にする（任意） */
  adminClaim:  envStr('OIDC_ADMIN_CLAIM'),
  adminValue:  envStr('OIDC_ADMIN_VALUE'),
} as const;

/** OIDC が実際に使える状態か（必須項目がすべて揃っているか） */
export const isOidcConfigured = (): boolean =>
  OIDC.enabled && !!OIDC.issuer && !!OIDC.clientId && !!OIDC.clientSecret;

// ─── SAML ─────────────────────────────────────────────────────────

export const SAML = {
  enabled: envBool('SAML_ENABLED', false),
  /** IdP のログインURL (SSO Service URL) */
  entryPoint: envStr('SAML_ENTRY_POINT'),
  /** SP の EntityID。未指定なら PUBLIC_URL + /api/auth/saml/metadata */
  issuer:     envStr('SAML_ISSUER'),
  /** IdP の署名検証用証明書（PEM本体、または改行を除いた Base64） */
  idpCert:    envStr('SAML_IDP_CERT'),
  /** 未指定なら PUBLIC_URL + /api/auth/saml/callback */
  callbackUrl: envStr('SAML_CALLBACK_URL'),
  label:       envStr('SAML_LABEL') ?? 'SAML でログイン',
  /** ユーザー名として使う属性名（未指定なら NameID） */
  usernameAttribute: envStr('SAML_USERNAME_ATTRIBUTE'),
  displayNameAttribute: envStr('SAML_DISPLAYNAME_ATTRIBUTE'),
  /** この属性にこの値が含まれるユーザーを管理者にする（任意） */
  adminAttribute: envStr('SAML_ADMIN_ATTRIBUTE'),
  adminValue:     envStr('SAML_ADMIN_VALUE'),
} as const;

/** SAML が実際に使える状態か */
export const isSamlConfigured = (): boolean =>
  SAML.enabled && !!SAML.entryPoint && !!SAML.idpCert;

// ─── SSO 共通 ──────────────────────────────────────────────────────

/**
 * SSO ログイン成功後にトークンを渡すためのフロントエンド URL。
 * 未指定なら同一オリジン（/sso/callback）を使う。
 */
export const SSO_SUCCESS_REDIRECT = envStr('SSO_SUCCESS_REDIRECT') ?? '/sso/callback';

/** SSO で初回ログインしたユーザーに与える既定ロール */
export const SSO_DEFAULT_ROLE: 'admin' | 'user' =
  envStr('SSO_DEFAULT_ROLE') === 'admin' ? 'admin' : 'user';
