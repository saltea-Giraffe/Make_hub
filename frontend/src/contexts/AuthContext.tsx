import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import axios from 'axios';

// ─── 型定義 ────────────────────────────────────────────────────────

export type AvatarType = 'emoji' | 'url' | 'upload' | 'initial';

export interface AuthUser {
  id: number;
  username: string;
  role: 'admin' | 'user';
  display_name: string | null;
  avatar_type: AvatarType;
  avatar_value: string | null;
}

export interface ProfileUpdate {
  display_name?: string | null;
  avatar_type?: AvatarType;
  avatar_value?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;          // 初期認証チェック中
  isAuthenticated: boolean;
  isAdmin: boolean;
  login:    (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: ProfileUpdate) => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'hub_token';

// ─── Provider ─────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [token, setToken]     = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /** トークンとユーザー情報をstateとlocalStorageにセット */
  const applyAuth = useCallback((newToken: string, newUser: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    // axiosデフォルトヘッダーにセット（全リクエストに自動付与）
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
  }, []);

  /** ログアウト処理 */
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  }, []);

  /** ページ読み込み時: localStorageのトークンを検証して認証状態を復元 */
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setIsLoading(false);
      return;
    }

    axios.defaults.headers.common['Authorization'] = `Bearer ${stored}`;

    axios
      .get<{ success: boolean; data: AuthUser }>('/api/auth/me')
      .then(res => {
        setToken(stored);
        setUser(res.data.data);
      })
      .catch(() => {
        // トークンが無効・期限切れの場合はクリア
        logout();
      })
      .finally(() => setIsLoading(false));
  }, [logout]);

  /** ログイン処理 */
  const login = async (username: string, password: string): Promise<void> => {
    const res = await axios.post<{
      success: boolean;
      data: { token: string; user: AuthUser };
      error?: string;
    }>('/api/auth/login', { username, password });

    if (!res.data.success) throw new Error(res.data.error ?? 'ログインに失敗しました');
    applyAuth(res.data.data.token, res.data.data.user);
  };

  /** 新規登録処理（登録後そのままログイン状態にする） */
  const register = async (username: string, password: string, confirmPassword: string): Promise<void> => {
    const res = await axios.post<{
      success: boolean;
      data: { token: string; user: AuthUser };
      error?: string;
    }>('/api/auth/register', { username, password, confirm_password: confirmPassword });

    if (!res.data.success) throw new Error(res.data.error ?? '登録に失敗しました');
    applyAuth(res.data.data.token, res.data.data.user);
  };

  /** プロフィール更新（サーバー更新 + ローカルstate更新） */
  const updateProfile = async (data: ProfileUpdate): Promise<void> => {
    const res = await axios.patch<{
      success: boolean;
      data: AuthUser & { is_active: 0 | 1 };
      error?: string;
    }>('/api/users/me', data);

    if (!res.data.success) throw new Error(res.data.error ?? 'プロフィールの更新に失敗しました');
    const u = res.data.data;
    setUser({
      id: u.id,
      username: u.username,
      role: u.role,
      display_name: u.display_name,
      avatar_type: u.avatar_type,
      avatar_value: u.avatar_value,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        login,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
