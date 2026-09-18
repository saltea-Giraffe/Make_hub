import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { requireAuth } from '../middleware/auth';

const router = Router();

// ─── GET /api/favorites ────────────────────────────────────────────
// 自分のお気に入りアプリID一覧
router.get('/', requireAuth, (req: Request, res: Response) => {
  const rows = db.prepare(
    'SELECT app_id FROM favorites WHERE user_id = ?'
  ).all(req.user!.id) as { app_id: number }[];
  res.json({ success: true, data: rows.map(r => r.app_id) });
});

// ─── POST /api/favorites/:appId ────────────────────────────────────
// お気に入り追加
router.post('/:appId', requireAuth, (req: Request, res: Response) => {
  const appId = Number(req.params.appId);
  const app = db.prepare('SELECT id FROM apps WHERE id = ?').get(appId);
  if (!app) { res.status(404).json({ success: false, error: 'App not found' }); return; }
  db.prepare(
    'INSERT OR IGNORE INTO favorites (user_id, app_id) VALUES (?, ?)'
  ).run(req.user!.id, appId);
  res.json({ success: true });
});

// ─── DELETE /api/favorites/:appId ─────────────────────────────────
// お気に入り削除
router.delete('/:appId', requireAuth, (req: Request, res: Response) => {
  db.prepare(
    'DELETE FROM favorites WHERE user_id = ? AND app_id = ?'
  ).run(req.user!.id, Number(req.params.appId));
  res.json({ success: true });
});

export default router;
