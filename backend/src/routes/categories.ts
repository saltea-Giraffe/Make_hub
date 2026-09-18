import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import db from '../db/connection';
import type { Category } from '../types';

const router = Router();

const categoryValidation = [
  body('name')
    .trim().notEmpty().withMessage('カテゴリ名は必須です')
    .isLength({ max: 50 }).withMessage('カテゴリ名は50文字以内で入力してください'),
  body('display_order').optional().isInt({ min: 0 }).toInt(),
];

function validate(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, error: errors.array()[0].msg });
    return false;
  }
  return true;
}

// GET /api/categories
router.get('/', (_req: Request, res: Response) => {
  const categories = db.prepare(
    'SELECT * FROM categories ORDER BY display_order ASC, id ASC'
  ).all() as Category[];
  res.json({ success: true, data: categories });
});

// POST /api/categories
router.post('/', categoryValidation, (req: Request, res: Response) => {
  if (!validate(req, res)) return;

  const { name, display_order } = req.body;
  const maxOrder = (db.prepare('SELECT COALESCE(MAX(display_order), 0) AS max FROM categories').get() as { max: number }).max;

  try {
    const result = db.prepare('INSERT INTO categories (name, display_order) VALUES (?, ?)').run(
      name, display_order ?? maxOrder + 1
    );
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid) as Category;
    res.status(201).json({ success: true, data: category, message: 'カテゴリを追加しました' });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('UNIQUE')) {
      res.status(409).json({ success: false, error: '同名のカテゴリが既に存在します' });
    } else {
      throw e;
    }
  }
});

// PUT /api/categories/:id
router.put('/:id', [param('id').isInt(), ...categoryValidation], (req: Request, res: Response) => {
  if (!validate(req, res)) return;

  const existing = db.prepare('SELECT id FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'カテゴリが見つかりません' });
    return;
  }

  try {
    db.prepare('UPDATE categories SET name = ?, display_order = ? WHERE id = ?').run(
      req.body.name, req.body.display_order ?? 0, req.params.id
    );
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id) as Category;
    res.json({ success: true, data: category, message: 'カテゴリを更新しました' });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('UNIQUE')) {
      res.status(409).json({ success: false, error: '同名のカテゴリが既に存在します' });
    } else {
      throw e;
    }
  }
});

// DELETE /api/categories/:id
router.delete('/:id', param('id').isInt(), (req: Request, res: Response) => {
  if (!validate(req, res)) return;

  const existing = db.prepare('SELECT id FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ success: false, error: 'カテゴリが見つかりません' });
    return;
  }

  // カテゴリを削除する前に、所属アプリを未分類に変更
  db.prepare('UPDATE apps SET category_id = NULL WHERE category_id = ?').run(req.params.id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'カテゴリを削除しました' });
});

export default router;
