import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';

export interface AuthPayload {
  id: number;
  username: string;
  role: 'admin' | 'user';
}

// Express の Request 型を拡張して req.user を使えるようにする
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/** JWTを検証してreq.userにセットする */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: '認証が必要です。ログインしてください。' });
    return;
  }

  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'トークンが無効または期限切れです。再度ログインしてください。' });
  }
}

/** 管理者ロールのみ通過させる（requireAuthも兼ねる） */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ success: false, error: '管理者権限が必要です。' });
      return;
    }
    next();
  });
}
