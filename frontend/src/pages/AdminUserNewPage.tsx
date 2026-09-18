import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Shield, User, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { createUser } from '../api/users';

interface FormState {
  username: string;
  password: string;
  confirm: string;
  role: 'admin' | 'user';
}

interface FormErrors {
  username?: string;
  password?: string;
  confirm?: string;
  _global?: string;
}

export default function AdminUserNewPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    username: '',
    password: '',
    confirm: '',
    role: 'user',
  });
  const [errors, setErrors]         = useState<FormErrors>({});
  const [saving, setSaving]         = useState(false);
  const [showPass, setShowPass]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone]             = useState(false);

  // ─── バリデーション ─────────────────────────────────────────────
  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.username.trim())
      e.username = 'ユーザー名は必須です';
    else if (!/^[a-zA-Z0-9_-]{3,50}$/.test(form.username))
      e.username = '半角英数字・アンダースコア・ハイフンで 3〜50 文字';

    if (!form.password)
      e.password = 'パスワードは必須です';
    else if (form.password.length < 6)
      e.password = '6 文字以上で入力してください';

    if (!form.confirm)
      e.confirm = '確認用パスワードは必須です';
    else if (form.password !== form.confirm)
      e.confirm = 'パスワードが一致しません';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ─── 送信 ───────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setErrors({});
    try {
      await createUser({
        username: form.username.trim(),
        password: form.password,
        role: form.role,
      });
      setDone(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'アカウントの作成に失敗しました';
      setErrors({ _global: msg });
    } finally {
      setSaving(false);
    }
  };

  // ─── 完了画面 ────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">アカウントを作成しました</h2>
        <p className="text-sm text-gray-500 mb-8">
          <span className="font-semibold text-gray-700">{form.username}</span> のアカウントが作成されました。
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => { setForm({ username: '', password: '', confirm: '', role: 'user' }); setDone(false); }}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            続けて作成する
          </button>
          <button
            onClick={() => navigate('/admin/users')}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            ユーザー一覧へ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-10">
      {/* ─── ヘッダー ────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <UserPlus className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">アカウント作成</h1>
          <p className="text-sm text-gray-500">新しいログインアカウントを作成します</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>

          {/* グローバルエラー */}
          {errors._global && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {errors._global}
            </div>
          )}

          {/* ─── ユーザー名 ──────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              ユーザー名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              autoFocus
              autoComplete="username"
              placeholder="例: yamada_taro"
              className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                errors.username ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:border-gray-400'
              }`}
            />
            {errors.username
              ? <p className="mt-1.5 text-xs text-red-600">{errors.username}</p>
              : <p className="mt-1.5 text-xs text-gray-400">半角英数字・アンダースコア（_）・ハイフン（-）、3〜50 文字</p>
            }
          </div>

          {/* ─── ロール選択 ──────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">ロール</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'user',  label: '一般ユーザー', desc: 'HUBを閲覧のみ',   icon: User,   color: 'gray' },
                { value: 'admin', label: '管理者',       desc: 'アプリ・ユーザー管理', icon: Shield, color: 'blue' },
              ] as const).map(({ value, label, desc, icon: Icon, color }) => (
                <label
                  key={value}
                  className={`flex flex-col gap-1 p-3.5 border-2 rounded-xl cursor-pointer transition-all ${
                    form.role === value
                      ? color === 'blue'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-400 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={value}
                    checked={form.role === value}
                    onChange={() => setForm(f => ({ ...f, role: value }))}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${form.role === value && color === 'blue' ? 'text-blue-600' : 'text-gray-500'}`} />
                    <span className="text-sm font-semibold text-gray-800">{label}</span>
                  </div>
                  <span className="text-xs text-gray-500 pl-6">{desc}</span>
                </label>
              ))}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* ─── パスワード ───────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              パスワード <span className="text-red-500">*</span>
              <span className="ml-1.5 text-xs text-gray-400 font-normal">（6 文字以上）</span>
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                autoComplete="new-password"
                placeholder="••••••••"
                className={`w-full px-3 py-2.5 pr-10 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                  errors.password ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                }`}
              />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="mt-1.5 text-xs text-red-600">{errors.password}</p>}
          </div>

          {/* ─── パスワード確認 ───────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              パスワード（確認） <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                autoComplete="new-password"
                placeholder="••••••••"
                className={`w-full px-3 py-2.5 pr-10 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                  errors.confirm ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                }`}
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirm && <p className="mt-1.5 text-xs text-red-600">{errors.confirm}</p>}
          </div>

          {/* ─── ボタン ───────────────────────────────────────── */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/admin/users')}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              {saving ? '作成中...' : 'アカウントを作成する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
