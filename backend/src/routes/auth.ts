import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../db/connection';
import { requireAuth, type AuthPayload } from '../middleware/auth';
import { JWT_SECRET, JWT_EXPIRES } from '../config';
import type { User } from '../types';

const router = Router();

// ─── POST /api/auth/login ──────────────────────────────────────────
router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('ユーザー名は必須です'),
    body('password').notEmpty().withMessage('パスワードは必須です'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ success: false, error: errors.array()[0].msg });
      return;
    }

    const { username, password } = req.body as { username: string; password: string };

    const user = db.prepare(
      'SELECT * FROM users WHERE username = ? AND is_active = 1'
    ).get(username) as User | undefined;

    // ユーザーが存在しない場合でも同じエラーを返す（ユーザー名の存在有無を隠す）
    const isValid = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!user || !isValid) {
      res.status(401).json({ success: false, error: 'ユーザー名またはパスワードが正しくありません' });
      return;
    }

    // 最終ログイン日時を更新
    db.prepare("UPDATE users SET last_login_at = datetime('now', 'localtime') WHERE id = ?").run(user.id);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role } satisfies AuthPayload,
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES } as jwt.SignOptions
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          display_name: user.display_name,
          avatar_type: user.avatar_type,
          avatar_value: user.avatar_value,
        },
      },
      message: 'ログインしました',
    });
  }
);

// ─── POST /api/auth/register ──────────────────────────────────────
// 誰でもアクセス可能な自己登録エンドポイント。ロールは常に 'user'。
router.post(
  '/register',
  [
    body('username')
      .trim().notEmpty().withMessage('ユーザー名は必須です')
      .isLength({ min: 3, max: 50 }).withMessage('ユーザー名は3〜50文字で入力してください')
      .matches(/^[a-zA-Z0-9_-]+$/).withMessage('ユーザー名は半角英数字・アンダースコア・ハイフンのみ使用できます'),
    body('password')
      .notEmpty().withMessage('パスワードは必須です')
      .isLength({ min: 6 }).withMessage('パスワードは6文字以上で入力してください'),
    body('confirm_password')
      .notEmpty().withMessage('確認用パスワードは必須です'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ success: false, error: errors.array()[0].msg });
      return;
    }

    const { username, password, confirm_password } = req.body as {
      username: string; password: string; confirm_password: string;
    };

    if (password !== confirm_password) {
      res.status(422).json({ success: false, error: 'パスワードと確認用パスワードが一致しません' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      res.status(409).json({ success: false, error: 'このユーザー名はすでに使用されています' });
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    const result = db.prepare(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'user')"
    ).run(username, hash);

    // 登録後そのままログイン状態にする
    const newId = Number(result.lastInsertRowid);
    const token = jwt.sign(
      { id: newId, username, role: 'user' } satisfies AuthPayload,
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES } as jwt.SignOptions
    );

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: newId,
          username,
          role: 'user',
          display_name: null,
          avatar_type: 'initial',
          avatar_value: null,
        },
      },
      message: 'アカウントを作成しました',
    });
  }
);

// ─── GET /api/auth/me ─────────────────────────────────────────────
// トークン検証 + 現在のユーザー情報を返す（フロントエンドの認証状態復元に使用）
router.get('/me', requireAuth, (req: Request, res: Response) => {
  const user = db.prepare(
    'SELECT id, username, role, is_active, display_name, avatar_type, avatar_value FROM users WHERE id = ?'
  ).get(req.user!.id) as Pick<User, 'id' | 'username' | 'role' | 'is_active' | 'display_name' | 'avatar_type' | 'avatar_value'> | undefined;

  if (!user || !user.is_active) {
    res.status(401).json({ success: false, error: 'ユーザーが無効です' });
    return;
  }

  res.json({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      role: user.role,
      display_name: user.display_name,
      avatar_type: user.avatar_type,
      avatar_value: user.avatar_value,
    },
  });
});

export default router;
