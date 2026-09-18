import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/**
 * 初回セットアップ画面
 *
 * ユーザーが1人も登録されていないときだけ表示され、
 * 最初の管理者アカウントをここで作る。
 * （v1.0.x までの admin/admin という既定アカウントは廃止した）
 */
export default function SetupPage() {
  const { setup } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: '', displayName: '', password: '', confirm: '',
  });
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<{
    username?: string; password?: string; confirm?: string; _global?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form, value: string) =>
    setForm(f => ({ ...f, [key]: value }));

  const validate = (): boolean => {
    const e: typeof errors = {};

    if (!form.username.trim()) e.username = 'ユーザー名は必須です';
    else if (!/^[a-zA-Z0-9_-]{3,50}$/.test(form.username))
      e.username = '半角英数字・アンダースコア・ハイフンで3〜50文字';

    if (!form.password) e.password = 'パスワードは必須です';
    else if (form.password.length < 8)
      e.password = '管理者パスワードは8文字以上にしてください';

    if (!form.confirm) e.confirm = '確認用パスワードは必須です';
    else if (form.password !== form.confirm) e.confirm = 'パスワードが一致しません';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setErrors({});
    if (!validate()) return;

    setLoading(true);
    try {
      await setup(form.username.trim(), form.password, form.confirm, form.displayName);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (err instanceof Error ? err.message : 'セットアップに失敗しました');
      setErrors({ _global: msg });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      hasError ? 'border-red-400 bg-red-50' : 'border-gray-300'
    }`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4 py-10 px-safe">
      <div className="w-full max-w-md">

        {/* ─── ロゴ ──────────────────────────────────────────── */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl shadow-lg mb-4">
            <LayoutGrid className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Make HUB へようこそ</h1>
          <p className="text-sm text-gray-500 mt-1">
            はじめに、管理者アカウントを作成してください
          </p>
        </div>

        {/* ─── カード ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 sm:px-7 py-3.5 bg-blue-50 border-b border-blue-100">
            <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <p className="text-sm font-medium text-blue-800">初期セットアップ</p>
          </div>

          <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-4" noValidate>
            {errors._global && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {errors._global}
              </div>
            )}

            <p className="text-xs text-gray-500 leading-relaxed bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
              ここで作るアカウントはすべての管理権限を持ちます。
              このアカウントの情報は後から変更できます。
            </p>

            {/* ユーザー名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                ユーザー名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.username}
                onChange={e => set('username', e.target.value)}
                autoComplete="username"
                autoFocus
                placeholder="例: admin"
                className={inputClass(!!errors.username)}
              />
              {errors.username
                ? <p className="mt-1 text-xs text-red-600">{errors.username}</p>
                : <p className="mt-1 text-xs text-gray-400">半角英数字・_ ・- で3〜50文字</p>
              }
            </div>

            {/* 表示名（任意） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                表示名 <span className="text-xs text-gray-400 font-normal">(任意)</span>
              </label>
              <input
                type="text"
                value={form.displayName}
                onChange={e => set('displayName', e.target.value)}
                maxLength={50}
                placeholder="例: 山田 太郎"
                className={inputClass(false)}
              />
              <p className="mt-1 text-xs text-gray-400">未入力の場合はユーザー名が表示されます</p>
            </div>

            {/* パスワード */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                パスワード <span className="text-red-500">*</span>
                <span className="ml-1 text-xs text-gray-400 font-normal">（8文字以上）</span>
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={`${inputClass(!!errors.password)} pr-10`}
                />
                <button type="button" tabIndex={-1}
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600"
                  aria-label="パスワードの表示切り替え"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
            </div>

            {/* パスワード確認 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                パスワード（確認） <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={form.confirm}
                  onChange={e => set('confirm', e.target.value)}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={`${inputClass(!!errors.confirm)} pr-10`}
                />
                <button type="button" tabIndex={-1}
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600"
                  aria-label="パスワードの表示切り替え"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirm && <p className="mt-1 text-xs text-red-600">{errors.confirm}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-60 transition-colors mt-2"
            >
              <ShieldCheck className="w-4 h-4" />
              {loading ? '作成中...' : '管理者アカウントを作成して始める'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
