// ============================================================
// 共有型定義（バックエンドの types/index.ts と同期させること）
// ============================================================

export interface App {
  id: number;
  name: string;
  description: string | null;
  url: string;
  icon_type: 'emoji' | 'url' | 'upload' | 'initial';
  icon_value: string | null;
  category_id: number | null;
  category_name: string | null;
  display_order: number;
  is_enabled: 0 | 1;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  display_order: number;
  created_at: string;
}

/** APIレスポンス共通形式 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Announcement {
  id: number;
  title: string;
  content: string | null;
  type: 'info' | 'warning' | 'success';
  is_active: 0 | 1;
  display_order: number;
  created_by: number | null;
  created_by_username?: string;
  created_at: string;
  updated_at: string;
}

export interface AppAccessStat {
  id: number;
  name: string;
  icon_type: string;
  icon_value: string | null;
  total_count: number;
  week_count: number;
  last_accessed_at: string | null;
}

/** アプリ登録・編集フォームのデータ型 */
export type AppFormData = {
  name: string;
  description: string;
  url: string;
  icon_type: 'emoji' | 'url' | 'upload' | 'initial';
  icon_value: string;
  category_id: number | null;
  display_order: number;
  is_enabled: 0 | 1;
};

/** リンク先から取得した OGP 情報 */
export interface OgpMetadata {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site_name: string | null;
}

/** ログイン画面に出す認証手段 */
export interface AuthProviders {
  local: boolean;
  oidc: { label: string; url: string } | null;
  saml: { label: string; url: string } | null;
}
