import { Router, Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback, MulterError } from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { DATA_DIR } from '../db/connection';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 許可するMIMEタイプ（セキュリティ: SVGはXSS注意のため必要な場合のみ有効化）
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  // 'image/svg+xml', // SVGはXSSリスクがあるため本番では慎重に
];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    // ファイル名にUUIDを使い、元のファイル名を排除（パストラバーサル対策）
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z]/g, '');
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('PNG/JPG/GIF/WebP のみアップロード可能です'));
    }
  },
});

/**
 * multer のアップロード処理をラップし、エラーを分かりやすい 400 JSON に変換する。
 * （未ラップだとファイルサイズ超過・許可外形式が 500 になってしまう）
 */
function handleUpload(field: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    upload.single(field)(req, res, (err: unknown) => {
      if (err) {
        const message =
          err instanceof MulterError
            ? err.code === 'LIMIT_FILE_SIZE'
              ? 'ファイルサイズが大きすぎます（2MBまで）'
              : 'アップロードに失敗しました'
            : err instanceof Error
              ? err.message
              : 'アップロードに失敗しました';
        res.status(400).json({ success: false, error: message });
        return;
      }
      next();
    });
  };
}

// ─── 簡易レート制限（アバターアップロードのスパム/ディスク枯渇対策）──
// 単一プロセス(NSSMサービス)前提で、プロセス内メモリに直近の実行時刻を保持する
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10分
const RATE_LIMIT_MAX = 20;                    // 10分あたり最大20回
const uploadHits = new Map<string, number[]>();

function rateLimitAvatar(req: Request, res: Response, next: NextFunction): void {
  const key = req.user ? `u:${req.user.id}` : `ip:${req.ip}`;
  const now = Date.now();
  const recent = (uploadHits.get(key) ?? []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    res.status(429).json({ success: false, error: 'アップロード回数が多すぎます。しばらくしてから再試行してください。' });
    return;
  }
  recent.push(now);
  uploadHits.set(key, recent);
  next();
}

// POST /api/upload/icon（アプリアイコン: 管理者のみ）
router.post('/icon', requireAdmin, handleUpload('icon'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'ファイルが選択されていません' });
    return;
  }

  // アクセス可能なURLを返す
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    success: true,
    data: { url: fileUrl, filename: req.file.filename },
    message: 'アイコンをアップロードしました',
  });
});

// POST /api/upload/avatar（自分のアバター: ログインユーザー本人）
router.post('/avatar', requireAuth, rateLimitAvatar, handleUpload('avatar'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'ファイルが選択されていません' });
    return;
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    success: true,
    data: { url: fileUrl, filename: req.file.filename },
    message: 'アバターをアップロードしました',
  });
});

export default router;
