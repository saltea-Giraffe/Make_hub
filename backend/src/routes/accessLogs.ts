import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

// ─── POST /api/access-logs ─────────────────────────────────────────
// アプリクリック記録
router.post('/', requireAuth, (req: Request, res: Response) => {
  const { app_id } = req.body as { app_id: number };
  if (!app_id) { res.status(422).json({ success: false, error: 'app_id is required' }); return; }
  db.prepare(
    'INSERT INTO access_logs (app_id, user_id) VALUES (?, ?)'
  ).run(app_id, req.user!.id);
  res.json({ success: true });
});

// ─── GET /api/access-logs/stats ───────────────────────────────────
// アプリ別アクセス集計（管理者）
router.get('/stats', requireAdmin, (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT
      a.id,
      a.name,
      a.icon_type,
      a.icon_value,
      COUNT(al.id) AS total_count,
      COUNT(CASE WHEN al.accessed_at >= datetime('now', '-7 days', 'localtime') THEN 1 END) AS week_count,
      MAX(al.accessed_at) AS last_accessed_at
    FROM apps a
    LEFT JOIN access_logs al ON a.id = al.app_id
    GROUP BY a.id
    ORDER BY total_count DESC, a.name ASC
  `).all();
  res.json({ success: true, data: rows });
});

export default router;
