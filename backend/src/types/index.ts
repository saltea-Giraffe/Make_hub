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

/** 認証方式。SSO ユーザーは password_hash を持たない */
export type AuthProvider = 'local' | 'oidc' | 'saml';

export interface User {
  id: number;
  username: string;
  /** SSO 専用アカウントは null */
  password_hash: string | null;
  role: 'admin' | 'user';
  is_active: 0 | 1;
  display_name: string | null;
  avatar_type: 'emoji' | 'url' | 'upload' | 'initial';
  avatar_value: string | null;
  email: string | null;
  auth_provider: AuthProvider;
  /** IdP 側のユーザー識別子（local の場合は null） */
  external_id: string | null;
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
  auth_provider: AuthProvider;
}

/** リンクのURLから取得した OGP 情報 */
export interface OgpMetadata {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site_name: string | null;
}
