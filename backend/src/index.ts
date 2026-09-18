import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
import { DATA_DIR } from './db/connection';
import appsRouter from './routes/apps';
import categoriesRouter from './routes/categories';
import uploadRouter from './routes/upload';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import announcementsRouter from './routes/announcements';
import favoritesRouter from './routes/favorites';
import accessLogsRouter from './routes/accessLogs';
import { requireAdmin } from './middleware/auth';
import { errorHandler, notFound } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT         = process.env.PORT         ?? 3001;
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

// ─── DB初期化（デフォルト管理者作成も含む） ──────────────────────
initializeSchema();

// ─── セキュリティミドルウェア ─────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // HTTP運用時に upgrade-insecure-requests が付くと CSS/JS が HTTPS で読まれて失敗する
    contentSecurityPolicy: false,
  })
);

// 本番環境ではフロントとバックが同一オリジンのため origin 制限不要
// 開発環境では FRONTEND_URL (localhost:5173) のみ許可
const corsOrigin = process.env.NODE_ENV === 'production' ? true : FRONTEND_URL;
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());
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

// ─── ヘルスチェック ────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Make HUB API is running',
    version: '1.0.0',
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
app.listen(PORT, () => {
  console.log(`🚀 Make HUB API  →  http://localhost:${PORT}`);
  console.log(`   Frontend origin     →  ${FRONTEND_URL}`);
  console.log(`   Data directory      →  ${DATA_DIR}`);
});

export default app;
