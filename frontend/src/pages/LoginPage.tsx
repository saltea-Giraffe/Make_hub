import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams, Navigate } from 'react-router-dom';
import { LayoutGrid, Eye, EyeOff, LogIn, UserPlus, KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchAuthProviders } from '../api/client';
import type { AuthProviders } from '../types';

type Tab = 'login' | 'register';

export default function LoginPage() {
  const { login, register, isAuthenticated, needsSetup } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState<Tab>('login');

  // SSO 設定の有無（バックエンドが有効と答えた方式だけボタンを出す）
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  // SSO 失敗時、バックエンドは /login?sso_error=... に戻してくる
  const ssoError = searchParams.get('sso_error');

  useEffect(() => {
    fetchAuthProviders()
      .then(res => setProviders(res.data ?? null))
      .catch(() => setProviders(null));  // 取得できなければ SSO ボタンを出さない
  }, []);

  // ログイン用フォーム
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginError, setLoginError]       = useState<string | null>(null);
  const [loginLoading, setLoginLoading]   = useState(false);

  // 登録用フォーム
  const [regForm, setRegForm] = useState({ username: '', password: '', confirm: '' });
  const [showRegPass, setShowRegPass]       = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);
  const [regErrors, setRegErrors] = useState<{ username?: string; password?: string; confirm?: string; _global?: string }>({});
  const [regLoading, setRegLoading] = useState(false);

  // ログイン済みならリダイレクト
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';
  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, navigate, from]);

  // タブ切替時にエラーをリセット
  const switchTab = (t: Tab) => {
    setTab(t);
    setLoginError(null);
    setRegErrors({});
  };

  // ─── ログイン送信 ──────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      await login(loginForm.username.trim(), loginForm.password);
    } catch (err: unknown) {
      setLoginError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
          ?? (err instanceof Error ? err.message : 'ログインに失敗しました')
      );
    } finally {
      setLoginLoading(false);
    }
  };

  // ─── 登録バリデーション ────────────────────────────────────────
  const validateReg = () => {
    const e: typeof regErrors = {};
    if (!regForm.username.trim())
      e.username = 'ユーザー名は必須です';
    else if (!/^[a-zA-Z0-9_-]{3,50}$/.test(regForm.username))
      e.username = '半角英数字・アンダースコア・ハイフンで3〜50文字';
    if (!regForm.password)
      e.password = 'パスワードは必須です';
    else if (regForm.password.length < 6)
      e.password = '6文字以上で入力してください';
    if (!regForm.confirm)
      e.confirm = '確認用パスワードは必須です';
    else if (regForm.password !== regForm.confirm)
      e.confirm = 'パスワードが一致しません';
    setRegErrors(e);
    return Object.keys(e).length === 0;
  };

  // ─── 登録送信 ──────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegErrors({});
    if (!validateReg()) return;
    setRegLoading(true);
    try {
      await register(regForm.username.trim(), regForm.password, regForm.confirm);
      // 登録後は useEffect が自動リダイレクト
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
          ?? (err instanceof Error ? err.message : '登録に失敗しました');
      setRegErrors({ _global: msg });
    } finally {
      setRegLoading(false);
    }
  };

  // 管理者がまだ居ない場合は、ログインではなく初期セットアップへ誘導する
  if (needsSetup) return <Navigate to="/setup" replace />;

  const hasSso = !!providers?.oidc || !!providers?.saml;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4 py-10 px-safe">
      <div className="w-full max-w-sm">

        {/* ─── ロゴ ──────────────────────────────────────────── */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl shadow-lg mb-4">
            <LayoutGrid className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Make HUB</h1>
          <p className="text-sm text-gray-500 mt-1">よく使うサービスへのアクセスをまとめて管理</p>
        </div>

        {/* ─── SSO エラー ────────────────────────────────────── */}
        {ssoError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {ssoError}
          </div>
        )}

        {/* ─── カード ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">

          {/* タブ */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => switchTab('login')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors ${
                tab === 'login'
                  ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <LogIn className="w-4 h-4" />
              ログイン
            </button>
            <button
              onClick={() => switchTab('register')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors ${
                tab === 'register'
                  ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              新規登録
            </button>
          </div>

          <div className="p-5 sm:p-7">
            {/* ══════════════ ログインフォーム ══════════════ */}
            {tab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                    {loginError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">ユーザー名</label>
                  <input
                    type="text"
                    value={loginForm.username}
                    onChange={e => setLoginForm(f => ({ ...f, username: e.target.value }))}
                    autoComplete="username"
                    autoFocus
                    required
                    placeholder="username"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">パスワード</label>
                  <div className="relative">
                    <input
                      type={showLoginPass ? 'text' : 'password'}
                      value={loginForm.password}
                      onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                      autoComplete="current-password"
                      required
                      placeholder="••••••••"
                      className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button type="button" tabIndex={-1}
                      onClick={() => setShowLoginPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showLoginPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-60 transition-colors mt-2"
                >
                  {loginLoading
                    ? <><Spinner />ログイン中...</>
                    : <><LogIn className="w-4 h-4" />ログイン</>
                  }
                </button>

                {import.meta.env.DEV && (
                  <p className="text-center text-xs text-gray-400 border-t border-gray-100 pt-3 mt-1">
                    初期値: <span className="font-mono">admin</span> / <span className="font-mono">admin</span>
                  </p>
                )}
              </form>
            )}

            {/* ══════════════ 新規登録フォーム ══════════════ */}
            {tab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4" noValidate>
                {regErrors._global && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                    {regErrors._global}
                  </div>
                )}

                {/* ユーザー名 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    ユーザー名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={regForm.username}
                    onChange={e => setRegForm(f => ({ ...f, username: e.target.value }))}
                    autoComplete="username"
                    autoFocus
                    placeholder="例: yamada_taro"
                    className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      regErrors.username ? 'border-red-400 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                  {regErrors.username
                    ? <p className="mt-1 text-xs text-red-600">{regErrors.username}</p>
                    : <p className="mt-1 text-xs text-gray-400">半角英数字・_ ・- で3〜50文字</p>
                  }
                </div>

                {/* パスワード */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    パスワード <span className="text-red-500">*</span>
                    <span className="ml-1 text-xs text-gray-400 font-normal">（6文字以上）</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPass ? 'text' : 'password'}
                      value={regForm.password}
                      onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className={`w-full px-3 py-2.5 pr-10 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        regErrors.password ? 'border-red-400 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                    <button type="button" tabIndex={-1}
                      onClick={() => setShowRegPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showRegPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {regErrors.password && <p className="mt-1 text-xs text-red-600">{regErrors.password}</p>}
                </div>

                {/* パスワード確認 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    パスワード（確認） <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showRegConfirm ? 'text' : 'password'}
                      value={regForm.confirm}
                      onChange={e => setRegForm(f => ({ ...f, confirm: e.target.value }))}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className={`w-full px-3 py-2.5 pr-10 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        regErrors.confirm ? 'border-red-400 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                    <button type="button" tabIndex={-1}
                      onClick={() => setShowRegConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showRegConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {regErrors.confirm && <p className="mt-1 text-xs text-red-600">{regErrors.confirm}</p>}
                </div>

                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-60 transition-colors mt-2"
                >
                  {regLoading
                    ? <><Spinner />登録中...</>
                    : <><UserPlus className="w-4 h-4" />アカウントを作成する</>
                  }
                </button>

                <p className="text-center text-xs text-gray-400 pt-1">
                  作成されたアカウントのロールは「一般ユーザー」になります
                </p>
              </form>
            )}

            {/* ══════════════ SSO ログイン ══════════════ */}
            {hasSso && (
              <div className="mt-6 pt-5 border-t border-gray-100 space-y-2">
                <p className="text-center text-xs text-gray-400 mb-3">または</p>

                {providers?.oidc && (
                  <a
                    href={providers.oidc.url}
                    className="w-full flex items-center justify-center gap-2 py-3 border border-gray-300 rounded-lg font-medium text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <KeyRound className="w-4 h-4 text-gray-500" />
                    {providers.oidc.label}
                  </a>
                )}

                {providers?.saml && (
                  <a
                    href={providers.saml.url}
                    className="w-full flex items-center justify-center gap-2 py-3 border border-gray-300 rounded-lg font-medium text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <KeyRound className="w-4 h-4 text-gray-500" />
                    {providers.saml.label}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── スピナー（ボタン内用） ────────────────────────────────────────
function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
