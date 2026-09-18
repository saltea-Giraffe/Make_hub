import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import https from 'https';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// ─── 環境変数の読み込み ────────────────────────────────────────────
// 本番: NSSM の AppDirectory (= process.cwd()) に置かれた .env を優先
// 開発: process.cwd() の .env（dotenvデフォルト）
const appDir = process.cwd();
const envFromAppDir = path.join(appDir, '.env');
if (fs.existsSync(envFromAppDir)) {
  dotenv.config({ path: envFromAppDir });
} else {
  dotenv.config();
}

import { initializeSchema } from './db/schema';
import { seedDefaults } from './db/seedDefaults';
import { DATA_DIR } from './db/connection';
import { PORT, HTTPS, PUBLIC_URL, isOidcConfigured, isSamlConfigured } from './config';
import { loadTlsMaterial } from './https';
import appsRouter from './routes/apps';
import categoriesRouter from './routes/categories';
import uploadRouter from './routes/upload';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import announcementsRouter from './routes/announcements';
import favoritesRouter from './routes/favorites';
import accessLogsRouter from './routes/accessLogs';
import ogpRouter from './routes/ogp';
import { requireAdmin } from './middleware/auth';
import { errorHandler, notFound } from './middleware/errorHandler';

const app = express();
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

/**
 * バージョンは package.json を単一の出典にする。
 * 配布時は index.js と package.json が同階層、開発時は dist/ の一つ上に置かれる。
 */
function readVersion(): string {
  const candidates = [
    path.join(__dirname, 'package.json'),
    path.join(__dirname, '..', 'package.json'),
  ];
  for (const file of candidates) {
    try {
      const pkg = JSON.parse(fs.readFileSync(file, 'utf-8')) as { version?: unknown };
      if (typeof pkg.version === 'string') return pkg.version;
    } catch { /* 次の候補を試す */ }
  }
  return '0.0.0';
}

const VERSION = readVersion();

// ─── DB初期化 + 初回サンプルデータ投入 ────────────────────────────
initializeSchema();
seedDefaults();

// ─── セキュリティミドルウェア ─────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // HTTP運用時に upgrade-insecure-requests が付くと CSS/JS が HTTPS で読まれて失敗する
    contentSecurityPolicy: false,
    // HSTS は既定で無効。自己署名証明書や HTTP に戻す可能性のある環境で
    // 有効にすると、そのホストに HTTP で戻れなくなるため。
    hsts: HTTPS.hsts ? undefined : false,
  })
);

// 本番環境ではフロントとバックが同一オリジンのため origin 制限不要
// 開発環境では FRONTEND_URL (localhost:5173) のみ許可
const corsOrigin = process.env.NODE_ENV === 'production' ? true : FRONTEND_URL;
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());
// SAML の HTTP-POST バインディングは application/x-www-form-urlencoded で届く
app.use(express.urlencoded({ extended: true }));

// ─── アップロードファイル配信 ──────────────────────────────────────
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
app.use('/uploads', express.static(UPLOAD_DIR));

// ─── 認証ルート（保護なし） ────────────────────────────────────────
app.use('/api/auth', authRouter);

// ─── アプリAPI ────────────────────────────────────────────────────
// GET（一覧・詳細）は認証不要 → HUBトップが未ログインでも表示できる
// POST / PUT / DELETE / PATCH は管理者のみ
app.use('/api/apps', (req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    requireAdmin(req, res, next);
  } else {
    next();
  }
});
app.use('/api/apps', appsRouter);

// ─── カテゴリAPI ──────────────────────────────────────────────────
// GET は認証不要、書き込みは管理者のみ
app.use('/api/categories', (req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    requireAdmin(req, res, next);
  } else {
    next();
  }
});
app.use('/api/categories', categoriesRouter);

// ─── アップロードAPI ──────────────────────────────────────────────
// 認証は各ルートで制御（/icon=管理者のみ, /avatar=ログインユーザー本人）
app.use('/api/upload', uploadRouter);

// ─── ユーザーAPI ──────────────────────────────────────────────────
// change-password は認証ユーザー本人、それ以外は管理者のみ（routes内で制御）
app.use('/api/users', usersRouter);

// ─── お知らせAPI ──────────────────────────────────────────────────
app.use('/api/announcements', announcementsRouter);

// ─── お気に入りAPI ────────────────────────────────────────────────
app.use('/api/favorites', favoritesRouter);

// ─── アクセスログAPI ──────────────────────────────────────────────
app.use('/api/access-logs', accessLogsRouter);

// ─── OGP取得API ───────────────────────────────────────────────────
// サーバーから任意のURLへ接続するため管理者のみに限定する
app.use('/api/ogp', requireAdmin, ogpRouter);

// ─── ヘルスチェック ────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Make HUB API is running',
    version: VERSION,
    environment: process.env.NODE_ENV ?? 'development',
  });
});

// ─── 本番モード: フロントエンド静的ファイル配信 ──────────────────
// NODE_ENV=production のとき、実行ファイルと同じディレクトリの frontend/ を配信
if (process.env.NODE_ENV === 'production') {
  const frontendDir = process.env.FRONTEND_DIR
    ?? path.join(appDir, 'frontend');
  if (fs.existsSync(frontendDir)) {
    app.use(express.static(frontendDir));
    // SPAフォールバック: /api 以外はすべて index.html を返す
    app.get(/^(?!\/api|\/uploads).*/, (_req, res) => {
      res.sendFile(path.join(frontendDir, 'index.html'));
    });
  }
}

// ─── エラーハンドラー（必ず最後に登録） ───────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── サーバー起動 ──────────────────────────────────────────────────

/** HTTP で来たリクエストを HTTPS へ 301 リダイレクトするだけのハンドラ */
function httpsRedirectHandler(req: http.IncomingMessage, res: http.ServerResponse): void {
  const hostHeader = req.headers.host ?? 'localhost';
  const hostname = hostHeader.split(':')[0];
  const port = HTTPS.port === 443 ? '' : `:${HTTPS.port}`;
  res.writeHead(301, { Location: `https://${hostname}${port}${req.url ?? '/'}` });
  res.end();
}

function logStartup(scheme: 'http' | 'https', port: number): void {
  console.log(`🚀 Make HUB v${VERSION}  →  ${scheme}://localhost:${port}`);
}

function start(): void {
  let tlsFailed = false;

  if (HTTPS.enabled) {
    try {
      const tls = loadTlsMaterial();
      https
        .createServer({ key: tls.key, cert: tls.cert, ca: tls.ca }, app)
        .listen(HTTPS.port, () => {
          logStartup('https', HTTPS.port);
          if (tls.selfSigned) {
            console.log('   ⚠️  自己署名証明書のため、ブラウザに警告が表示されます');
            console.log(`   証明書の保存先: ${tls.directory}`);
          }
        });
    } catch (err) {
      tlsFailed = true;
      console.error('[エラー] HTTPS を開始できませんでした:', err instanceof Error ? err.message : err);
      console.error('         HTTP のみで起動します。証明書の設定を見直してください。');
    }
  }

  const httpsRunning = HTTPS.enabled && !tlsFailed;

  // HTTPS 稼働中かつリダイレクト設定のときは、HTTP は誘導だけを行う
  if (httpsRunning && HTTPS.redirectHttp) {
    http.createServer(httpsRedirectHandler).listen(PORT, () => {
      console.log(`↪️  http://localhost:${PORT} → https://localhost:${HTTPS.port} にリダイレクトします`);
    });
  } else {
    http.createServer(app).listen(PORT, () => logStartup('http', PORT));
  }

  console.log(`   Frontend origin     →  ${FRONTEND_URL}`);
  console.log(`   Data directory      →  ${DATA_DIR}`);
  if (PUBLIC_URL) console.log(`   Public URL          →  ${PUBLIC_URL}`);
  if (isOidcConfigured()) console.log('   OIDC (SSO)          →  有効');
  if (isSamlConfigured()) console.log('   SAML (SSO)          →  有効');
}

start();

export default app;
