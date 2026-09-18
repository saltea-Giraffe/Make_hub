// ============================================================
// ドメイン型定義
// 将来的にユーザー・ロール・テナント等を追加する場合はここに追記
// ============================================================

export interface App {
  id: number;
  name: string;
  description: string | null;
  url: string;
  /** アイコンの種類: emoji=絵文字, url=外部URL, upload=アップロード済み, initial=頭文字自動 */
  icon_type: 'emoji' | 'url' | 'upload' | 'initial';
  icon_value: string | null;
  category_id: number | null;
  display_order: number;
  /** 0=無効, 1=有効 */
  is_enabled: 0 | 1;
  created_at: string;
  updated_at: string;
  // JOINで付加される
  category_name?: string | null;
}

export interface Category {
  id: number;
  name: string;
  display_order: number;
  created_at: string;
}

/** 統一APIレスポンス形式 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 将来拡張: ユーザー・ロール
export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: 'admin' | 'user';
  is_active: 0 | 1;
  display_name: string | null;
  avatar_type: 'emoji' | 'url' | 'upload' | 'initial';
  avatar_value: string | null;
  created_at: string;
  last_login_at: string | null;
}

/** 認証レスポンス等で返す公開プロフィール情報 */
export interface PublicUser {
  id: number;
  username: string;
  role: 'admin' | 'user';
  display_name: string | null;
  avatar_type: 'emoji' | 'url' | 'upload' | 'initial';
  avatar_value: string | null;
}
