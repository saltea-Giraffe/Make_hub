import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, CheckCircle } from 'lucide-react';
import { changePassword } from '../api/users';

type Field = 'current_password' | 'new_password' | 'confirm_password';

export default function ChangePasswordPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [show, setShow] = useState<Record<Field, boolean>>({
    current_password: false,
    new_password: false,
    confirm_password: false,
  });
  const [errors, setErrors] = useState<Partial<Record<Field | '_global', string>>>({});
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (key: Field, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const toggleShow = (key: Field) =>
    setShow(prev => ({ ...prev, [key]: !prev[key] }));

  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!form.current_password)  e.current_password = '現在のパスワードを入力してください';
    if (!form.new_password)      e.new_password = '新しいパスワードを入力してください';
    else if (form.new_password.length < 6) e.new_password = '6文字以上で入力してください';
    if (!form.confirm_password)  e.confirm_password = '確認用パスワードを入力してください';
    else if (form.new_password !== form.confirm_password)
      e.confirm_password = '新しいパスワードと一致しません';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setErrors({});
    try {
      await changePassword(form);
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'パスワードの変更に失敗しました';
      setErrors({ _global: msg });
    } finally {
      setSaving(false);
    }
  };

  // ─── 成功画面 ────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">パスワードを変更しました</h2>
        <p className="text-sm text-gray-500 mb-6">次回ログインから新しいパスワードが有効になります。</p>
        <button
          onClick={() => navigate('/')}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          HUBトップへ戻る
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-3 mb-6">
        <KeyRound className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">パスワード変更</h1>
          <p className="text-sm text-gray-500">現在のパスワードと新しいパスワードを入力してください</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {errors._global && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {errors._global}
            </div>
          )}

          {/* 現在のパスワード */}
          <PasswordField
            label="現在のパスワード"
            value={form.current_password}
            onChange={v => set('current_password', v)}
            show={show.current_password}
            onToggleShow={() => toggleShow('current_password')}
            error={errors.current_password}
            autoComplete="current-password"
          />

          <hr className="border-gray-100" />

          {/* 新しいパスワード */}
          <PasswordField
            label="新しいパスワード"
            value={form.new_password}
            onChange={v => set('new_password', v)}
            show={show.new_password}
            onToggleShow={() => toggleShow('new_password')}
            error={errors.new_password}
            autoComplete="new-password"
            hint="6文字以上"
          />

          {/* 確認用パスワード */}
          <PasswordField
            label="新しいパスワード（確認）"
            value={form.confirm_password}
            onChange={v => set('confirm_password', v)}
            show={show.confirm_password}
            onToggleShow={() => toggleShow('confirm_password')}
            error={errors.confirm_password}
            autoComplete="new-password"
          />

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? '変更中...' : 'パスワードを変更する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── パスワード入力フィールド（共通部品）──────────────────────────
interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  error?: string;
  autoComplete?: string;
  hint?: string;
}

function PasswordField({ label, value, onChange, show, onToggleShow, error, autoComplete, hint }: PasswordFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {hint && <span className="ml-1.5 text-xs text-gray-400 font-normal">({hint})</span>}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={`w-full px-3 py-2 pr-10 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            error ? 'border-red-400 bg-red-50' : 'border-gray-300'
          }`}
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          tabIndex={-1}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
