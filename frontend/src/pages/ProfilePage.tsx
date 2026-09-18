import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, User as UserIcon } from 'lucide-react';
import { useAuth, type AvatarType } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { uploadAvatar } from '../api/users';
import Avatar from '../components/Avatar';

const EMOJI_PRESETS = [
  '😀','😎','🤖','👨‍💻','👩‍💻','🧑‍🎓','🐱','🐶','🦊','🐼',
  '🦁','🐯','🐨','🐸','🐙','🦄','🌸','🌟','🔥','🚀',
];

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [avatarType, setAvatarType]   = useState<AvatarType>(user?.avatar_type ?? 'initial');
  const [avatarValue, setAvatarValue] = useState<string>(user?.avatar_value ?? '');
  const [saving, setSaving]           = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [nameError, setNameError]     = useState<string | null>(null);

  if (!user) return null;

  const fallbackName = displayName.trim() || user.username;

  const validateName = (v: string): string | null => {
    const trimmed = v.trim();
    if (trimmed === '') return null; // 空はOK (username がフォールバック)
    if (trimmed.length < 1 || trimmed.length > 50) return '表示名は1〜50文字で入力してください';
    return null;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await uploadAvatar(file);
      if (res.data) setAvatarValue(res.data.url);
    } catch {
      setError('アップロードに失敗しました');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const nErr = validateName(displayName);
    setNameError(nErr);
    if (nErr) return;

    setSaving(true);
    setError(null);
    try {
      await updateProfile({
        display_name: displayName.trim() === '' ? null : displayName.trim(),
        avatar_type: avatarType,
        avatar_value: avatarType === 'initial' ? null : (avatarValue || null),
      });
      toast('プロフィールを更新しました', 'success');
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'プロフィールの更新に失敗しました';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <UserIcon className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">プロフィール</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">表示名とアバターを変更できます</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <form onSubmit={handleSave} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* プレビュー */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
            <Avatar
              type={avatarType}
              value={avatarValue}
              fallbackName={fallbackName}
              size="xl"
            />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">プレビュー</p>
              <p className="font-semibold text-gray-900 dark:text-white mt-0.5 text-lg">{fallbackName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">@{user.username}</p>
            </div>
          </div>

          {/* ユーザー名 (読み取り専用) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ユーザー名</label>
            <input
              type="text"
              value={user.username}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-400">ユーザー名は変更できません</p>
          </div>

          {/* 表示名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              表示名 <span className="text-xs text-gray-400 font-normal">(1〜50文字 / 未入力時はユーザー名)</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); setNameError(validateName(e.target.value)); }}
              maxLength={50}
              placeholder="例: 山田 太郎"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                nameError ? 'border-red-400 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
          </div>

          {/* アバター */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">アバター</label>

            {/* タブ切替 */}
            <div className="flex gap-1 mb-3 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg w-fit">
              {(['emoji', 'url', 'upload', 'initial'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    // モード切替時は前モードの値が新モードに適合しないためクリアする
                    if (tab !== avatarType) setAvatarValue('');
                    setAvatarType(tab);
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    avatarType === tab
                      ? 'bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white'
                  }`}
                >
                  {tab === 'emoji' ? '絵文字' : tab === 'url' ? '画像URL' : tab === 'upload' ? 'アップロード' : '自動(頭文字)'}
                </button>
              ))}
            </div>

            {/* 絵文字 */}
            {avatarType === 'emoji' && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {EMOJI_PRESETS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setAvatarValue(emoji)}
                      className={`w-9 h-9 text-xl flex items-center justify-center rounded-lg border-2 transition-all ${
                        avatarValue === emoji
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 scale-110'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={avatarValue}
                  onChange={e => setAvatarValue(e.target.value)}
                  placeholder="または絵文字を直接入力"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            )}

            {/* 画像URL */}
            {avatarType === 'url' && (
              <input
                type="text"
                value={avatarValue}
                onChange={e => setAvatarValue(e.target.value)}
                placeholder="https://example.com/avatar.png"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            )}

            {/* アップロード */}
            {avatarType === 'upload' && (
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
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? 'アップロード中...' : 'ファイルを選択（PNG/JPG/GIF/WebP, 2MB以内）'}
                </button>
                {avatarValue && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 break-all">{avatarValue}</p>
                )}
              </div>
            )}

            {/* 頭文字 */}
            {avatarType === 'initial' && (
              <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg text-sm text-gray-500 dark:text-gray-400">
                表示名の頭文字がアバターとして自動表示されます。
              </div>
            )}
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving || uploading || !!nameError}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? '保存中...' : '保存する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
