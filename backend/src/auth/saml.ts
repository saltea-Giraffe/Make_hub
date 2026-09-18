import { Router, Request, Response } from 'express';
import { SAML as SamlClient } from '@node-saml/node-saml';
import { SAML as SAML_CONFIG, PUBLIC_URL, isSamlConfigured } from '../config';
import {
  upsertSsoUser, issueToken, buildSuccessRedirect, buildFailureRedirect,
  SsoError, type SsoProfile,
} from './ssoUsers';

const router = Router();

/**
 * 証明書を PEM 形式に正規化する。
 * .env には改行が書けないため、BEGIN/END 行が無い素の Base64 も受け付ける。
 */
function normalizeCert(raw: string): string {
  const trimmed = raw.trim().replace(/\\n/g, '\n');
  if (trimmed.includes('BEGIN CERTIFICATE')) return trimmed;

  const body = trimmed.replace(/\s+/g, '');
  const lines = body.match(/.{1,64}/g) ?? [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`;
}

function callbackUrl(): string {
  if (SAML_CONFIG.callbackUrl) return SAML_CONFIG.callbackUrl;
  if (!PUBLIC_URL) {
    throw new SsoError('SAML を使うには PUBLIC_URL か SAML_CALLBACK_URL を .env に設定してください');
  }
  return `${PUBLIC_URL}/api/auth/saml/callback`;
}

function spIssuer(): string {
  if (SAML_CONFIG.issuer) return SAML_CONFIG.issuer;
  if (!PUBLIC_URL) {
    throw new SsoError('SAML を使うには PUBLIC_URL か SAML_ISSUER を .env に設定してください');
  }
  return `${PUBLIC_URL}/api/auth/saml/metadata`;
}

let client: SamlClient | null = null;

function getClient(): SamlClient {
  if (!client) {
    client = new SamlClient({
      entryPoint: SAML_CONFIG.entryPoint!,
      issuer: spIssuer(),
      callbackUrl: callbackUrl(),
      // node-saml v4 では IdP 証明書のオプション名は cert
      cert: normalizeCert(SAML_CONFIG.idpCert!),
      // アサーション本体の署名は必須。レスポンス全体の署名は
      // IdP によって付かないことがあるため必須にしない。
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: false,
    });
  }
  return client;
}

/** profile からの属性取り出し（node-saml は属性を直下にも attributes 下にも置く） */
function readAttribute(profile: Record<string, unknown>, name: string | undefined): string | null {
  if (!name) return null;

  const direct = profile[name];
  const nested = (profile.attributes as Record<string, unknown> | undefined)?.[name];
  const value = direct ?? nested;

  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.length ? String(value[0]) : null;
  return String(value);
}

function attributeContains(
  profile: Record<string, unknown>, name: string | undefined, expected: string
): boolean {
  if (!name) return false;
  const value = profile[name] ?? (profile.attributes as Record<string, unknown> | undefined)?.[name];
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.map(String).includes(expected);
  const s = String(value);
  return s === expected || s.split(/[\s,]+/).includes(expected);
}

function toProfile(profile: Record<string, unknown>): SsoProfile {
  const nameId = String(profile.nameID ?? '');
  const email =
    readAttribute(profile, 'email') ??
    readAttribute(profile, 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress') ??
    (nameId.includes('@') ? nameId : null);

  const username =
    readAttribute(profile, SAML_CONFIG.usernameAttribute) ??
    (email ? email.split('@')[0] : null) ??
    nameId;

  const displayName =
    readAttribute(profile, SAML_CONFIG.displayNameAttribute) ??
    readAttribute(profile, 'displayName') ??
    readAttribute(profile, 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name');

  const isAdmin =
    !!SAML_CONFIG.adminValue &&
    attributeContains(profile, SAML_CONFIG.adminAttribute, SAML_CONFIG.adminValue);

  return {
    provider: 'saml',
    externalId: nameId,
    username,
    displayName,
    email,
    isAdmin,
  };
}

// ─── GET /api/auth/saml/login ─────────────────────────────────────
router.get('/login', async (_req: Request, res: Response) => {
  if (!isSamlConfigured()) {
    res.redirect(buildFailureRedirect('SAML は設定されていません'));
    return;
  }

  try {
    const url = await getClient().getAuthorizeUrlAsync('', undefined, {});
    res.redirect(url);
  } catch (err) {
    const message = err instanceof SsoError
      ? err.message
      : 'SAML の設定に問題があります。管理者にお問い合わせください。';
    if (!(err instanceof SsoError)) console.error('[SAML] 認可リクエストの生成に失敗:', err);
    res.redirect(buildFailureRedirect(message));
  }
});

// ─── POST /api/auth/saml/callback ─────────────────────────────────
// IdP は HTTP-POST バインディングでここにアサーションを返す
router.post('/callback', async (req: Request, res: Response) => {
  if (!isSamlConfigured()) {
    res.redirect(buildFailureRedirect('SAML は設定されていません'));
    return;
  }

  try {
    const { profile } = await getClient().validatePostResponseAsync(
      req.body as Record<string, string>
    );
    if (!profile) throw new SsoError('SAML アサーションを検証できませんでした');

    const user = upsertSsoUser(toProfile(profile as unknown as Record<string, unknown>));
    res.redirect(buildSuccessRedirect(issueToken(user)));
  } catch (err) {
    const message = err instanceof SsoError
      ? err.message
      : 'SAML ログインに失敗しました。管理者にお問い合わせください。';
    if (!(err instanceof SsoError)) console.error('[SAML] コールバック処理に失敗:', err);
    res.redirect(buildFailureRedirect(message));
  }
});

// ─── GET /api/auth/saml/metadata ──────────────────────────────────
// IdP に登録するための SP メタデータ（XML）
router.get('/metadata', (_req: Request, res: Response) => {
  if (!isSamlConfigured()) {
    res.status(404).json({ success: false, error: 'SAML は設定されていません' });
    return;
  }

  try {
    const xml = getClient().generateServiceProviderMetadata(null, null);
    res.type('application/xml').send(xml);
  } catch (err) {
    const message = err instanceof SsoError ? err.message : 'メタデータを生成できませんでした';
    if (!(err instanceof SsoError)) console.error('[SAML] メタデータ生成に失敗:', err);
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
