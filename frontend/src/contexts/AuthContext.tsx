import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import axios from 'axios';

// ─── 型定義 ────────────────────────────────────────────────────────

export type AvatarType = 'emoji' | 'url' | 'upload' | 'initial';
export type AuthProvider = 'local' | 'oidc' | 'saml';

export interface AuthUser {
  id: number;
  username: string;
  role: 'admin' | 'user';
  display_name: string | null;
  avatar_type: AvatarType;
  avatar_value: string | null;
  /** どの方式でログインしたアカウントか。SSO ユーザーはパスワードを持たない */
  auth_provider: AuthProvider;
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
  /** 管理者がまだ1人も居ない（初回セットアップが必要）。判定前は null */
  needsSetup: boolean | null;
  login:    (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, confirmPassword: string) => Promise<void>;
  /** 初回セットアップ: 最初の管理者アカウントを作成する */
  setup: (username: string, password: string, confirmPassword: string, displayName?: string) => Promise<void>;
  /** SSO コールバックで受け取ったトークンでログイン状態にする */
  applyToken: (token: string) => Promise<void>;
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
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

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

  /** ページ読み込み時: セットアップ要否の確認 + 保存済みトークンの検証 */
  useEffect(() => {
    let cancelled = false;

    const checkSetup = axios
      .get<{ success: boolean; data: { needs_setup: boolean } }>('/api/auth/setup-status')
      .then(res => { if (!cancelled) setNeedsSetup(res.data.data.needs_setup); })
      // サーバーに繋がらない場合はセットアップ画面に飛ばさず、通常の画面でエラーを見せる
      .catch(() => { if (!cancelled) setNeedsSetup(false); });

    const stored = localStorage.getItem(TOKEN_KEY);
    const restore = !stored
      ? Promise.resolve()
      : (() => {
          axios.defaults.headers.common['Authorization'] = `Bearer ${stored}`;
          return axios
            .get<{ success: boolean; data: AuthUser }>('/api/auth/me')
            .then(res => {
              if (cancelled) return;
              setToken(stored);
              setUser(res.data.data);
            })
            // トークンが無効・期限切れの場合はクリア
            .catch(() => { if (!cancelled) logout(); });
        })();

    Promise.all([checkSetup, restore]).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
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

  /** 初回セットアップ: 最初の管理者を作成してそのままログインする */
  const setup = async (
    username: string, password: string, confirmPassword: string, displayName?: string
  ): Promise<void> => {
    const res = await axios.post<{
      success: boolean;
      data: { token: string; user: AuthUser };
      error?: string;
    }>('/api/auth/setup', {
      username,
      password,
      confirm_password: confirmPassword,
      display_name: displayName?.trim() ? displayName.trim() : null,
    });

    if (!res.data.success) throw new Error(res.data.error ?? 'セットアップに失敗しました');
    setNeedsSetup(false);
    applyAuth(res.data.data.token, res.data.data.user);
  };

  /** SSO コールバックで受け取ったトークンを検証して適用する */
  const applyToken = async (newToken: string): Promise<void> => {
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    try {
      const res = await axios.get<{ success: boolean; data: AuthUser }>('/api/auth/me');
      setNeedsSetup(false);
      applyAuth(newToken, res.data.data);
    } catch (err) {
      // 無効なトークンを保存したままにしない
      logout();
      throw err;
    }
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
    setUser(prev => ({
      id: u.id,
      username: u.username,
      role: u.role,
      display_name: u.display_name,
      avatar_type: u.avatar_type,
      avatar_value: u.avatar_value,
      // /api/users/me は auth_provider を返さないため、既存の値を保持する
      auth_provider: prev?.auth_provider ?? 'local',
    }));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        needsSetup,
        login,
        register,
        setup,
        applyToken,
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
