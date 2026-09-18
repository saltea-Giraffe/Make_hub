import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
}

/**
 * グローバルエラーハンドラー
 * Express の4引数ミドルウェアとして登録する
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const isDev = process.env.NODE_ENV !== 'production';

  // 500系エラーはサーバーログに記録
  if (statusCode >= 500) {
    console.error(`[ERROR] ${req.method} ${req.path}`, err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: statusCode === 500 && !isDev ? 'Internal Server Error' : err.message,
    ...(isDev && statusCode === 500 ? { stack: err.stack } : {}),
  });
}

/** 404ハンドラー */
export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
}
