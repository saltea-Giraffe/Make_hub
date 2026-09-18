import crypto from 'crypto';

/**
 * JWT 関連の設定を一元管理する。
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
