import { useState, useEffect, useRef } from 'react';
import { Upload, Wand2, Check, AlertCircle } from 'lucide-react';
import Modal from '../components/Modal';
import { createApp, updateApp, fetchCategories, uploadIcon, fetchOgp } from '../api/client';
import type { App, AppFormData, Category } from '../types';

// よく使う絵文字プリセット
const EMOJI_PRESETS = [
  '📊','📋','💼','🔧','🖥️','📱','🌐','📧','📅','💬',
  '📁','⚙️','🔐','📈','🎯','🏢','🕐','💰','📚','🔍',
  '👥','🚀','📦','🛡️','🔔','🗂️','📝','🖨️','🔗','⭐',
];

const DEFAULT_FORM: AppFormData = {
  name: '',
  description: '',
  url: 'https://',
  icon_type: 'emoji',
  icon_value: '🖥️',
  category_id: null,
  display_order: 0,
  is_enabled: 1,
};

interface Props {
  isOpen: boolean;
  app: App | null;    // null = 新規追加モード
  onClose: () => void;
  onSaved: () => void;
}

type IconTab = 'emoji' | 'url' | 'upload' | 'initial';

export default function AppFormModal({ isOpen, app, onClose, onSaved }: Props) {
  const [form, setForm]         = useState<AppFormData>(DEFAULT_FORM);
  const [categories, setCategories] = useState<Category[]>([]);
  const [errors, setErrors]     = useState<Partial<Record<keyof AppFormData | '_global', string>>>({});
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [iconTab, setIconTab]   = useState<IconTab>('emoji');
  // OGP 自動取得の進捗表示
  const [ogpState, setOgpState] = useState<
    { status: 'idle' } | { status: 'loading' } |
    { status: 'done'; filled: string[] } | { status: 'error'; message: string }
  >({ status: 'idle' });
  const fileRef = useRef<HTMLInputElement>(null);

  // カテゴリ取得
  useEffect(() => {
    fetchCategories().then(r => setCategories(r.data ?? []));
  }, []);

  // モーダルが開くたびにフォームリセット
  useEffect(() => {
    if (!isOpen) return;
    if (app) {
      setForm({
        name:          app.name,
        description:   app.description ?? '',
        url:           app.url,
        icon_type:     app.icon_type,
        icon_value:    app.icon_value ?? '',
        category_id:   app.category_id,
        display_order: app.display_order,
        is_enabled:    app.is_enabled,
      });
      setIconTab(app.icon_type);
    } else {
      setForm(DEFAULT_FORM);
      setIconTab('emoji');
    }
    setErrors({});
    setOgpState({ status: 'idle' });
  }, [app, isOpen]);

  const set = <K extends keyof AppFormData>(key: K, value: AppFormData[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!form.name.trim())  e.name = '名前は必須です';
    if (!form.url.trim())   e.url  = 'URLは必須です';
    else {
      try { new URL(form.url); }
      catch { e.url = '有効なURL形式で入力してください（例: https://...）'; }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const data: AppFormData = { ...form, icon_type: iconTab };
      if (app) {
        await updateApp(app.id, data);
      } else {
        await createApp(data);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErrors({ _global: msg ?? '保存に失敗しました' });
    } finally {
      setSaving(false);
    }
  };

  /**
   * URL から OGP 情報を取得してフォームを埋める。
   * 取得できた項目だけを上書きし、取れなかった項目は今の入力を残す。
   */
  const handleFetchOgp = async () => {
    const url = form.url.trim();
    if (!url || url === 'https://') {
      setOgpState({ status: 'error', message: '先に URL を入力してください' });
      return;
    }
    try {
      new URL(url);
    } catch {
      setOgpState({ status: 'error', message: '有効なURL形式で入力してください' });
      return;
    }

    setOgpState({ status: 'loading' });
    try {
      const res = await fetchOgp(url);
      const data = res.data;
      if (!data) throw new Error('情報を取得できませんでした');

      const filled: string[] = [];
      if (data.title) {
        set('name', data.title);
        filled.push('アプリ名');
      }
      if (data.description) {
        set('description', data.description);
        filled.push('説明文');
      }
      if (data.image) {
        setIconTab('url');
        set('icon_type', 'url');
        set('icon_value', data.image);
        filled.push('アイコン');
      }

      setOgpState(filled.length
        ? { status: 'done', filled }
        : { status: 'error', message: 'このページからは情報を取得できませんでした' });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (err instanceof Error ? err.message : '情報を取得できませんでした');
      setOgpState({ status: 'error', message });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadIcon(file);
      if (res.data) set('icon_value', res.data.url);
    } catch {
      setErrors(prev => ({ ...prev, _global: 'アップロードに失敗しました' }));
    } finally {
      setUploading(false);
      // 同じファイルを再選択できるようリセット
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={app ? 'アプリを編集' : 'アプリを追加'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* グローバルエラー */}
        {errors._global && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {errors._global}
          </div>
        )}

        {/* ─── 名前 ──────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            アプリ名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            maxLength={100}
            placeholder="例: 勤怠管理システム"
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.name ? 'border-red-400 bg-red-50' : 'border-gray-300'
            }`}
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>

        {/* ─── URL ───────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            URL <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={form.url}
              onChange={e => { set('url', e.target.value); setOgpState({ status: 'idle' }); }}
              placeholder="https://example.com"
              inputMode="url"
              className={`flex-1 min-w-0 px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.url ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            />
            <button
              type="button"
              onClick={handleFetchOgp}
              disabled={ogpState.status === 'loading'}
              title="リンク先のタイトル・説明・アイコンを取得して自動入力します"
              className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 flex-shrink-0"
            >
              <Wand2 className="w-4 h-4" />
              {ogpState.status === 'loading' ? '取得中...' : '自動入力'}
            </button>
          </div>
          {errors.url && <p className="mt-1 text-xs text-red-600">{errors.url}</p>}

          {/* OGP 取得結果 */}
          {ogpState.status === 'done' && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-green-700">
              <Check className="w-3.5 h-3.5 flex-shrink-0" />
              {ogpState.filled.join('・')}を自動入力しました
            </p>
          )}
          {ogpState.status === 'error' && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
              {ogpState.message}
            </p>
          )}
        </div>

        {/* ─── 説明文 ─────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">説明文</label>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="アプリの説明（任意）"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* ─── アイコン ────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">アイコン</label>

          {/* タブ切替 */}
          <div className="flex flex-wrap gap-1 mb-3 bg-gray-100 p-1 rounded-lg w-full sm:w-fit">
            {(['emoji', 'url', 'upload', 'initial'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => { setIconTab(tab); set('icon_type', tab); }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  iconTab === tab
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab === 'emoji' ? '絵文字' : tab === 'url' ? '画像URL' : tab === 'upload' ? 'アップロード' : '自動(頭文字)'}
              </button>
            ))}
          </div>

          {/* 絵文字選択 */}
          {iconTab === 'emoji' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_PRESETS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => set('icon_value', emoji)}
                    className={`w-9 h-9 text-xl flex items-center justify-center rounded-lg border-2 transition-all ${
                      form.icon_value === emoji
                        ? 'border-blue-500 bg-blue-50 scale-110'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={form.icon_value}
                onChange={e => set('icon_value', e.target.value)}
                placeholder="または絵文字を直接入力（例: 🚀）"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* 画像URL入力 */}
          {iconTab === 'url' && (
            <input
              type="text"
              value={form.icon_value}
              onChange={e => set('icon_value', e.target.value)}
              placeholder="https://example.com/icon.png"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {/* ファイルアップロード */}
          {iconTab === 'upload' && (
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                {uploading ? 'アップロード中...' : 'ファイルを選択（PNG/JPG/GIF/WebP, 2MB以内）'}
              </button>
              {form.icon_value && iconTab === 'upload' && (
                <div className="flex items-center gap-2">
                  <img
                    src={form.icon_value}
                    alt="アイコンプレビュー"
                    className="w-12 h-12 object-contain rounded-lg border border-gray-200"
                  />
                  <span className="text-xs text-gray-500 break-all">{form.icon_value}</span>
                </div>
              )}
            </div>
          )}

          {/* 頭文字自動 */}
          {iconTab === 'initial' && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl text-white font-bold">
                {(form.name || 'A').charAt(0).toUpperCase()}
              </div>
              <p className="text-sm text-gray-500">アプリ名の頭文字がアイコンとして自動表示されます。</p>
            </div>
          )}
        </div>

        {/* ─── カテゴリ・表示順 ──────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
            <select
              value={form.category_id ?? ''}
              onChange={e => set('category_id', e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">未分類</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">表示順</label>
            <input
              type="number"
              value={form.display_order}
              onChange={e => set('display_order', Number(e.target.value))}
              min={0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* ─── 有効/無効 ─────────────────────────────────────── */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.is_enabled === 1}
            onChange={e => set('is_enabled', e.target.checked ? 1 : 0)}
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">HUBトップに表示する（有効）</span>
        </label>

        {/* ─── ボタン ─────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? '保存中...' : app ? '更新する' : '追加する'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
