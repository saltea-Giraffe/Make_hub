import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import db from '../db/connection';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

interface Announcement {
  id: number;
  title: string;
  content: string | null;
  type: 'info' | 'warning' | 'success';
  is_active: number;
  display_order: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

// ─── GET /api/announcements ────────────────────────────────────────
// 有効なお知らせ一覧（認証ユーザー向け）
router.get('/', requireAuth, (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT * FROM announcements WHERE is_active = 1
    ORDER BY display_order ASC, created_at DESC
  `).all() as Announcement[];
  res.json({ success: true, data: rows });
});

// ─── GET /api/announcements/all ────────────────────────────────────
// 全お知らせ（管理者向け）
router.get('/all', requireAdmin, (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT a.*, u.username as created_by_username
    FROM announcements a
    LEFT JOIN users u ON a.created_by = u.id
    ORDER BY a.display_order ASC, a.created_at DESC
  `).all();
  res.json({ success: true, data: rows });
});

// ─── POST /api/announcements ───────────────────────────────────────
router.post(
  '/',
  requireAdmin,
  [
    body('title').trim().notEmpty().withMessage('タイトルは必須です'),
    body('type').isIn(['info', 'warning', 'success']).withMessage('typeが不正です'),
  ],
  (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ success: false, error: errors.array()[0].msg });
      return;
    }
    const { title, content, type, is_active, display_order } = req.body as {
      title: string; content?: string; type: string; is_active?: number; display_order?: number;
    };
    const result = db.prepare(`
      INSERT INTO announcements (title, content, type, is_active, display_order, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      title,
      content ?? null,
      type ?? 'info',
      is_active ?? 1,
      display_order ?? 0,
      req.user!.id,
    );
    const created = db.prepare('SELECT * FROM announcements WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: created });
  }
);

// ─── PUT /api/announcements/:id ────────────────────────────────────
router.put(
  '/:id',
  requireAdmin,
  [body('title').trim().notEmpty().withMessage('タイトルは必須です')],
  (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ success: false, error: errors.array()[0].msg });
      return;
    }
    const { title, content, type, is_active, display_order } = req.body as {
      title: string; content?: string; type?: string; is_active?: number; display_order?: number;
    };
    db.prepare(`
      UPDATE announcements
      SET title = ?, content = ?, type = ?, is_active = ?, display_order = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(title, content ?? null, type ?? 'info', is_active ?? 1, display_order ?? 0, req.params.id);
    const updated = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
    if (!updated) { res.status(404).json({ success: false, error: 'Not found' }); return; }
    res.json({ success: true, data: updated });
  }
);

// ─── DELETE /api/announcements/:id ────────────────────────────────
router.delete('/:id', requireAdmin, (req: Request, res: Response) => {
  const result = db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
  if (result.changes === 0) { res.status(404).json({ success: false, error: 'Not found' }); return; }
  res.json({ success: true });
});

export default router;
