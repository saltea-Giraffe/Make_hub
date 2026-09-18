import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import db from '../db/connection';
import type { App } from '../types';

const router = Router();

// ─── バリデーションルール ───────────────────────────────────────────
const appValidation = [
  body('name')
    .trim().notEmpty().withMessage('名前は必須です')
    .isLength({ max: 100 }).withMessage('名前は100文字以内で入力してください'),
  body('url')
    .trim().notEmpty().withMessage('URLは必須です')
    .isURL({ require_protocol: true }).withMessage('有効なURL（https://...）を入力してください'),
  body('description').optional({ nullable: true }).trim().isLength({ max: 500 }),
  body('icon_type').optional().isIn(['emoji', 'url', 'upload', 'initial']),
  body('icon_value').optional({ nullable: true }).trim(),
  body('category_id').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
  body('display_order').optional().isInt({ min: 0 }).toInt(),
  body('is_enabled').optional().isInt({ min: 0, max: 1 }).toInt(),
];

function validate(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, error: errors.array()[0].msg });
    return false;
  }
  return true;
}

// ─── GET /api/apps ─────────────────────────────────────────────────
router.get('/', (req: Request, res: Response) => {
  const { search, category_id, enabled_only } = req.query;

  let sql = `
    SELECT a.*, c.name AS category_name
    FROM apps a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (enabled_only === 'true') {
    sql += ' AND a.is_enabled = 1';
  }
  if (category_id && category_id !== 'all') {
    sql += ' AND a.category_id = ?';
    params.push(Number(category_id));
  }
  if (search) {
    sql += ' AND (a.name LIKE ? OR a.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY a.display_order ASC, a.id ASC';

  const apps = db.prepare(sql).all(...params) as App[];
  res.json({ success: true, data: apps });
});

// ─── GET /api/apps/:id ─────────────────────────────────────────────
router.get('/:id', param('id').isInt(), (req: Request, res: Response) => {
  if (!validate(req, res)) return;

  const app = db.prepare(`
    SELECT a.*, c.name AS category_name
    FROM apps a
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE a.id = ?
  `).get(req.params.id) as App | undefined;

  if (!app) {
    res.status(404).json({ success: false, error: 'アプリが見つかりません' });
    return;
  }
  res.json({ success: true, data: app });
});

// ─── POST /api/apps ────────────────────────────────────────────────
router.post('/', appValidation, (req: Request, res: Response) => {
  if (!validate(req, res)) return;

  const { name, description, url, icon_type, icon_value, category_id, display_order, is_enabled } = req.body;
  const maxOrder = (db.prepare('SELECT COALESCE(MAX(display_order), 0) AS max FROM apps').get() as { max: number }).max;

  const result = db.prepare(`
    INSERT INTO apps (name, description, url, icon_type, icon_value, category_id, display_order, is_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name,
    description ?? null,
    url,
    icon_type ?? 'initial',
    icon_value ?? null,
    category_id ?? null,
    display_order ?? maxOrder + 1,
    is_enabled ?? 1,
  );

  const app = db.prepare('SELECT * FROM apps WHERE id = ?').get(result.lastInsertRowid) as App;
  res.status(201).json({ success: true, data: app, message: 'アプリを追加しました' });
});

// ─── PUT /api/apps/:id ─────────────────────────────────────────────
router.put('/:id', [param('id').isInt(), ...appValidation], (req: Request, res: Response) => {
  if (!validate(req, res)) return;

  const existing = db.prepare('SELECT id FROM apps WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'アプリが見つかりません' });
    return;
  }

  const { name, description, url, icon_type, icon_value, category_id, display_order, is_enabled } = req.body;

  db.prepare(`
    UPDATE apps SET
      name = ?, description = ?, url = ?,
      icon_type = ?, icon_value = ?,
      category_id = ?, display_order = ?, is_enabled = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(
    name,
    description ?? null,
    url,
    icon_type ?? 'initial',
    icon_value ?? null,
    category_id ?? null,
    display_order ?? 0,
    is_enabled ?? 1,
    req.params.id,
  );

  const app = db.prepare('SELECT * FROM apps WHERE id = ?').get(req.params.id) as App;
  res.json({ success: true, data: app, message: 'アプリを更新しました' });
});

// ─── DELETE /api/apps/:id ──────────────────────────────────────────
router.delete('/:id', param('id').isInt(), (req: Request, res: Response) => {
  if (!validate(req, res)) return;

  const existing = db.prepare('SELECT id FROM apps WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'アプリが見つかりません' });
    return;
  }

  db.prepare('DELETE FROM apps WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'アプリを削除しました' });
});

// ─── PATCH /api/apps/reorder ───────────────────────────────────────
// 表示順を一括更新 (drag & drop 対応用)
router.patch('/reorder', (req: Request, res: Response) => {
  const { orders } = req.body as { orders: { id: number; display_order: number }[] };
  if (!Array.isArray(orders)) {
    res.status(400).json({ success: false, error: '不正なリクエスト形式です' });
    return;
  }

  const update = db.prepare('UPDATE apps SET display_order = ? WHERE id = ?');
  const updateMany = db.transaction((items: { id: number; display_order: number }[]) => {
    for (const item of items) update.run(item.display_order, item.id);
  });
  updateMany(orders);

  res.json({ success: true, message: '表示順を更新しました' });
});

export default router;
