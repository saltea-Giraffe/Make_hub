import axios from 'axios';
import type { App, AppFormData, Category, Announcement, AppAccessStat, ApiResponse } from '../types';

/**
 * Axiosインスタンス
 * baseURL は Vite の proxy 設定により /api → http://localhost:3001/api に転送される
 * 本番ビルド時は環境変数 VITE_API_BASE_URL で上書き可能
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// リクエストインターセプター: AuthContextがaxios.defaultsに設定したトークンを引き継ぐ
api.interceptors.request.use(config => {
  const auth = axios.defaults.headers.common['Authorization'];
  if (auth) config.headers['Authorization'] = auth;
  return config;
});

// レスポンスエラーのロギング（将来: Sentryへの送信など）
api.interceptors.response.use(
  res => res,
  err => {
    console.error('[API Error]', err.response?.data ?? err.message);
    return Promise.reject(err);
  }
);

// ─── Apps ─────────────────────────────────────────────────────────

export const fetchApps = (params?: {
  search?: string;
  category_id?: number | string;
  enabled_only?: boolean;
}): Promise<ApiResponse<App[]>> =>
  api.get<ApiResponse<App[]>>('/apps', { params }).then(r => r.data);

export const fetchApp = (id: number): Promise<ApiResponse<App>> =>
  api.get<ApiResponse<App>>(`/apps/${id}`).then(r => r.data);

export const createApp = (data: AppFormData): Promise<ApiResponse<App>> =>
  api.post<ApiResponse<App>>('/apps', data).then(r => r.data);

export const updateApp = (id: number, data: AppFormData): Promise<ApiResponse<App>> =>
  api.put<ApiResponse<App>>(`/apps/${id}`, data).then(r => r.data);

export const reorderApps = (orders: { id: number; display_order: number }[]): Promise<ApiResponse<null>> =>
  api.patch<ApiResponse<null>>('/apps/reorder', { orders }).then(r => r.data);

export const deleteApp = (id: number): Promise<ApiResponse<null>> =>
  api.delete<ApiResponse<null>>(`/apps/${id}`).then(r => r.data);

// ─── Categories ───────────────────────────────────────────────────

export const fetchCategories = (): Promise<ApiResponse<Category[]>> =>
  api.get<ApiResponse<Category[]>>('/categories').then(r => r.data);

export const createCategory = (data: { name: string; display_order?: number }): Promise<ApiResponse<Category>> =>
  api.post<ApiResponse<Category>>('/categories', data).then(r => r.data);

export const updateCategory = (id: number, data: { name: string; display_order?: number }): Promise<ApiResponse<Category>> =>
  api.put<ApiResponse<Category>>(`/categories/${id}`, data).then(r => r.data);

export const deleteCategory = (id: number): Promise<ApiResponse<null>> =>
  api.delete<ApiResponse<null>>(`/categories/${id}`).then(r => r.data);

// ─── Announcements ────────────────────────────────────────────────

export const fetchAnnouncements = (): Promise<ApiResponse<Announcement[]>> =>
  api.get<ApiResponse<Announcement[]>>('/announcements').then(r => r.data);

export const fetchAllAnnouncements = (): Promise<ApiResponse<Announcement[]>> =>
  api.get<ApiResponse<Announcement[]>>('/announcements/all').then(r => r.data);

export const createAnnouncement = (data: Partial<Announcement>): Promise<ApiResponse<Announcement>> =>
  api.post<ApiResponse<Announcement>>('/announcements', data).then(r => r.data);

export const updateAnnouncement = (id: number, data: Partial<Announcement>): Promise<ApiResponse<Announcement>> =>
  api.put<ApiResponse<Announcement>>(`/announcements/${id}`, data).then(r => r.data);

export const deleteAnnouncement = (id: number): Promise<ApiResponse<null>> =>
  api.delete<ApiResponse<null>>(`/announcements/${id}`).then(r => r.data);

// ─── Favorites ────────────────────────────────────────────────────

export const fetchFavorites = (): Promise<ApiResponse<number[]>> =>
  api.get<ApiResponse<number[]>>('/favorites').then(r => r.data);

export const addFavorite = (appId: number): Promise<ApiResponse<null>> =>
  api.post<ApiResponse<null>>(`/favorites/${appId}`).then(r => r.data);

export const removeFavorite = (appId: number): Promise<ApiResponse<null>> =>
  api.delete<ApiResponse<null>>(`/favorites/${appId}`).then(r => r.data);

// ─── Access Logs ──────────────────────────────────────────────────

export const logAccess = (appId: number): Promise<ApiResponse<null>> =>
  api.post<ApiResponse<null>>('/access-logs', { app_id: appId }).then(r => r.data);

export const fetchAccessStats = (): Promise<ApiResponse<AppAccessStat[]>> =>
  api.get<ApiResponse<AppAccessStat[]>>('/access-logs/stats').then(r => r.data);

// ─── Upload ───────────────────────────────────────────────────────

export const uploadIcon = (file: File): Promise<ApiResponse<{ url: string; filename: string }>> => {
  const form = new FormData();
  form.append('icon', file);
  return axios
    .post<ApiResponse<{ url: string; filename: string }>>(
      `${import.meta.env.VITE_API_BASE_URL ?? '/api'}/upload/icon`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    .then(r => r.data);
};
