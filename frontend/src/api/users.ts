import axios from 'axios';
import type { ApiResponse } from '../types';

export type AvatarType = 'emoji' | 'url' | 'upload' | 'initial';

export interface UserRecord {
  id: number;
  username: string;
  role: 'admin' | 'user';
  is_active: 0 | 1;
  display_name: string | null;
  avatar_type: AvatarType;
  avatar_value: string | null;
  created_at: string;
  last_login_at: string | null;
}

export const fetchUsers = (): Promise<ApiResponse<UserRecord[]>> =>
  axios.get<ApiResponse<UserRecord[]>>('/api/users').then(r => r.data);

export const createUser = (data: {
  username: string;
  password: string;
  role: 'admin' | 'user';
}): Promise<ApiResponse<UserRecord>> =>
  axios.post<ApiResponse<UserRecord>>('/api/users', data).then(r => r.data);

export const toggleUser = (id: number): Promise<ApiResponse<null>> =>
  axios.patch<ApiResponse<null>>(`/api/users/${id}/toggle`).then(r => r.data);

export const deleteUser = (id: number): Promise<ApiResponse<null>> =>
  axios.delete<ApiResponse<null>>(`/api/users/${id}`).then(r => r.data);

export const changePassword = (data: {
  current_password: string;
  new_password: string;
  confirm_password: string;
}): Promise<ApiResponse<null>> =>
  axios.post<ApiResponse<null>>('/api/users/change-password', data).then(r => r.data);

export const uploadAvatar = (file: File): Promise<ApiResponse<{ url: string; filename: string }>> => {
  const form = new FormData();
  form.append('avatar', file);
  return axios
    .post<ApiResponse<{ url: string; filename: string }>>(
      '/api/upload/avatar',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    .then(r => r.data);
};
