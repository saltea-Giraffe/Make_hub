import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import db, { DATA_DIR } from '../db/connection';
import { requireAuth, requireAdmin } from '../middleware/auth';
import type { User } from '../types';

const router = Router();

const SALT_ROUNDS = 10;
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

/** アップロード済みアバターの正しいパス形式（/uploads/<safe-filename>） */
const UPLOAD_PATH_RE = /^\/uploads\/[A-Za-z0-9._-]+$/;

/**
 * 'upload' タイプで保存されていたアバター画像ファイルを削除する。
 * uploads ディレクトリ外を絶対に触らないよう検証してから unlink する。
 * （プロフィール差し替え・ユーザー削除時のディスクリーク防止）
 */
function deleteUploadedAvatar(value: string | null | undefined): void {
  if (!value || !UPLOAD_PATH_RE.test(value)) return;
  const filename = value.slice('/uploads/'.length);
  const filePath = path.join(UPLOAD_DIR, filename);
  if (path.dirname(filePath) !== UPLOAD_DIR) return; // パストラバーサル防止
  fs.promises.unlink(filePath).catch(() => { /* 既に存在しない場合は無視 */ });
}

function validate(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, error: errors.array()[0].msg });
    return false;
  }
  return true;
}

// ─── GET /api/users ─── 一覧（管理者のみ）────────────────────────
router.get('/', requireAdmin, (_req: Request, res: Response) => {
  const users = db.prepare(
    'SELECT id, username, role, is_active, display_name, avatar_type, avatar_value, created_at, last_login_at FROM users ORDER BY id ASC'
  ).all() as Omit<User, 'password_hash'>[];
  res.json({ success: true, data: users });
});

// ─── GET /api/users/me ─── 自分のプロフィール取得 ──────────────
router.get('/me', requireAuth, (req: Request, res: Response) => {
  const user = db.prepare(
    'SELECT id, username, role, is_active, display_name, avatar_type, avatar_value, created_at, last_login_at FROM users WHERE id = ?'
  ).get(req.user!.id) as Omit<User, 'password_hash'> | undefined;

  if (!user) {
    res.status(404).json({ success: false, error: 'ユーザーが見つかりません' });
    return;
  }
  res.json({ success: true, data: user });
});

// ─── PATCH /api/users/me ─── 自分のプロフィール更新 ────────────
router.patch(
  '/me',
  requireAuth,
  [
    body('display_name')
      .optional({ nullable: true })
      .custom(v => v === null || v === '' || (typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= 50))
      .withMessage('表示名は1〜50文字で入力してください'),
    body('avatar_type')
      .optional()
      .isIn(['emoji', 'url', 'upload', 'initial']).withMessage('avatar_type が不正です'),
    body('avatar_value')
      .optional({ nullable: true })
      .custom(v => v === null || (typeof v === 'string' && v.length <= 2048))
      .withMessage('avatar_value は2048文字以内の文字列で指定してください'),
  ],
  (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const { display_name, avatar_type, avatar_value } = req.body as {
      display_name?: string | null;
      avatar_type?: 'emoji' | 'url' | 'upload' | 'initial';
      avatar_value?: string | null;
    };

    // 空文字は NULL 扱いとして保存
    const normalizedDisplayName =
      display_name === undefined ? undefined
      : display_name === null || display_name.trim() === '' ? null
      : display_name.trim();

    // 現在の値を取得（更新後の実効的な type/value を判定するため）
    const current = db.prepare(
      'SELECT avatar_type, avatar_value FROM users WHERE id = ?'
    ).get(req.user!.id) as Pick<User, 'avatar_type' | 'avatar_value'> | undefined;
    if (!current) {
      res.status(404).json({ success: false, error: 'ユーザーが見つかりません' });
      return;
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    if (normalizedDisplayName !== undefined) {
      updates.push('display_name = ?');
      params.push(normalizedDisplayName);
    }

    // アバターは type と value の整合性を必ず担保する。
    // type / value のどちらかでも指定されたら、両カラムを整合した実効値で更新する。
    const wantsAvatarChange = avatar_type !== undefined || avatar_value !== undefined;
    let oldUploadToDelete: string | null = null;

    if (wantsAvatarChange) {
      const effectiveType = avatar_type ?? current.avatar_type;
      let effectiveValue: string | null =
        avatar_value !== undefined ? avatar_value : current.avatar_value;

      // type ↔ value の整合性検証・正規化
      if (effectiveType === 'initial') {
        effectiveValue = null;
      } else if (effectiveType === 'emoji') {
        // 絵文字は短い文字列のみ。パス/URL（'/' を含む）は拒否する
        if (!effectiveValue || effectiveValue.length > 16 || effectiveValue.includes('/')) {
          res.status(422).json({ success: false, error: '絵文字アバターの値が不正です' });
          return;
        }
      } else if (effectiveType === 'url') {
        if (!effectiveValue || !/^https?:\/\/[^\s]+$/i.test(effectiveValue) || effectiveValue.length > 2048) {
          res.status(422).json({ success: false, error: '画像URLは http(s) から始まるURLを指定してください' });
          return;
        }
      } else if (effectiveType === 'upload') {
        if (!effectiveValue || !UPLOAD_PATH_RE.test(effectiveValue)) {
          res.status(422).json({ success: false, error: 'アップロード画像の指定が不正です' });
          return;
        }
      }

      // 旧アバターがアップロード画像で、値が変わるなら後で削除する
      if (current.avatar_type === 'upload' && current.avatar_value && current.avatar_value !== effectiveValue) {
        oldUploadToDelete = current.avatar_value;
      }

      updates.push('avatar_type = ?');
      params.push(effectiveType);
      updates.push('avatar_value = ?');
      params.push(effectiveValue);
    }

    if (updates.length === 0) {
      res.status(400).json({ success: false, error: '更新項目がありません' });
      return;
    }

    params.push(req.user!.id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    // 差し替えられた古いアップロード画像を削除（ディスクリーク防止）
    if (oldUploadToDelete) deleteUploadedAvatar(oldUploadToDelete);

    const user = db.prepare(
      'SELECT id, username, role, is_active, display_name, avatar_type, avatar_value, created_at, last_login_at FROM users WHERE id = ?'
    ).get(req.user!.id) as Omit<User, 'password_hash'>;

    res.json({ success: true, data: user, message: 'プロフィールを更新しました' });
  }
);

// ─── POST /api/users ─── 新規作成（管理者のみ）───────────────────
router.post(
  '/',
  requireAdmin,
  [
    body('username')
      .trim().notEmpty().withMessage('ユーザー名は必須です')
      .isLength({ min: 3, max: 50 }).withMessage('ユーザー名は3〜50文字で入力してください')
      .matches(/^[a-zA-Z0-9_-]+$/).withMessage('ユーザー名は半角英数字・アンダースコア・ハイフンのみ使用できます'),
    body('password')
      .notEmpty().withMessage('パスワードは必須です')
      .isLength({ min: 6 }).withMessage('パスワードは6文字以上で入力してください'),
    body('role')
      .optional()
      .isIn(['admin', 'user']).withMessage('ロールは admin または user を指定してください'),
  ],
  async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const { username, password, role } = req.body as { username: string; password: string; role?: string };

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      res.status(409).json({ success: false, error: '同名のユーザーが既に存在します' });
      return;
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = db.prepare(
      "INSERT INTO users (username, password_hash, role, auth_provider) VALUES (?, ?, ?, 'local')"
    ).run(username, hash, role ?? 'user');

    const user = db.prepare(
      'SELECT id, username, role, is_active, created_at FROM users WHERE id = ?'
    ).get(result.lastInsertRowid) as Omit<User, 'password_hash'>;

    res.status(201).json({ success: true, data: user, message: 'ユーザーを作成しました' });
  }
);

// ─── PATCH /api/users/:id/toggle ─── 有効/無効切替（管理者のみ）─
router.patch('/:id/toggle', requireAdmin, param('id').isInt(), (req: Request, res: Response) => {
  if (!validate(req, res)) return;

  // 自分自身を無効化できないようにする
  if (Number(req.params.id) === req.user!.id) {
    res.status(400).json({ success: false, error: '自分自身のアカウントは無効化できません' });
    return;
  }

  const user = db.prepare('SELECT id, is_active FROM users WHERE id = ?').get(req.params.id) as Pick<User, 'id' | 'is_active'> | undefined;
  if (!user) {
    res.status(404).json({ success: false, error: 'ユーザーが見つかりません' });
    return;
  }

  const newState = user.is_active ? 0 : 1;
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(newState, req.params.id);
  res.json({
    success: true,
    message: newState ? 'ユーザーを有効化しました' : 'ユーザーを無効化しました',
  });
});

// ─── DELETE /api/users/:id ─── 削除（管理者のみ）────────────────
router.delete('/:id', requireAdmin, param('id').isInt(), (req: Request, res: Response) => {
  if (!validate(req, res)) return;

  if (Number(req.params.id) === req.user!.id) {
    res.status(400).json({ success: false, error: '自分自身のアカウントは削除できません' });
    return;
  }

  const user = db.prepare('SELECT id, avatar_type, avatar_value FROM users WHERE id = ?')
    .get(req.params.id) as Pick<User, 'id' | 'avatar_type' | 'avatar_value'> | undefined;
  if (!user) {
    res.status(404).json({ success: false, error: 'ユーザーが見つかりません' });
    return;
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);

  // 削除ユーザーのアップロード済みアバター画像も削除（ディスクリーク防止）
  if (user.avatar_type === 'upload') deleteUploadedAvatar(user.avatar_value);

  res.json({ success: true, message: 'ユーザーを削除しました' });
});

// ─── POST /api/users/change-password ─── パスワード変更（本人）──
router.post(
  '/change-password',
  requireAuth,
  [
    body('current_password').notEmpty().withMessage('現在のパスワードは必須です'),
    body('new_password')
      .notEmpty().withMessage('新しいパスワードは必須です')
      .isLength({ min: 6 }).withMessage('新しいパスワードは6文字以上で入力してください'),
    body('confirm_password').notEmpty().withMessage('確認用パスワードは必須です'),
  ],
  async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    const { current_password, new_password, confirm_password } = req.body as {
      current_password: string;
      new_password: string;
      confirm_password: string;
    };

    if (new_password !== confirm_password) {
      res.status(422).json({ success: false, error: '新しいパスワードと確認用パスワードが一致しません' });
      return;
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as User | undefined;
    if (!user) {
      res.status(404).json({ success: false, error: 'ユーザーが見つかりません' });
      return;
    }

    // SSO 専用アカウントはパスワードを持たないため変更できない
    if (!user.password_hash) {
      res.status(400).json({
        success: false,
        error: 'SSO でログインしているアカウントのため、パスワードは変更できません。',
      });
      return;
    }

    const isValid = await bcrypt.compare(current_password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ success: false, error: '現在のパスワードが正しくありません' });
      return;
    }

    const hash = await bcrypt.hash(new_password, SALT_ROUNDS);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
    res.json({ success: true, message: 'パスワードを変更しました' });
  }
);

export default router;
