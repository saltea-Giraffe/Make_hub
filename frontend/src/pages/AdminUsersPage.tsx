import { useState, useEffect } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, RefreshCw, Shield, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import Avatar from '../components/Avatar';
import { fetchUsers, toggleUser, deleteUser, type UserRecord } from '../api/users';
import { useAuth } from '../contexts/AuthContext';

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const navigate     = useNavigate();

  const [users, setUsers]             = useState<UserRecord[]>([]);
  const [loading, setLoading]         = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [toggling, setToggling]       = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchUsers();
      setUsers(res.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ─── 有効/無効切替 ──────────────────────────────────────────────
  const handleToggle = async (user: UserRecord) => {
    setToggling(user.id);
    try {
      await toggleUser(user.id);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '更新に失敗しました';
      alert(msg);
    } finally {
      setToggling(null);
    }
  };

  // ─── 削除 ───────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUser(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '削除に失敗しました';
      alert(msg);
    }
  };

  const formatDate = (dt: string | null) =>
    dt ? new Date(dt).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ─── ページヘッダー ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ユーザー管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">ログインアカウントの作成・有効化/無効化・削除</p>
        </div>
        <button
          onClick={() => navigate('/admin/users/new')}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm flex-shrink-0 self-start"
        >
          <Plus className="w-4 h-4" />
          アカウント作成
        </button>
      </div>

      {/* ─── テーブル ─────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">読み込み中...</span>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* 狭い画面では横スクロールで逃がす */}
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[340px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">ユーザー名</th>
                <th className="px-4 py-3 font-semibold text-gray-600 w-24">ロール</th>
                <th className="px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">最終ログイン</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-center w-20">状態</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-right w-20">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400 text-sm">
                    ユーザーが登録されていません
                  </td>
                </tr>
              ) : (
                users.map(u => {
                  const isMe = u.id === me?.id;
                  return (
                    <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      {/* ユーザー名 (アバター + 表示名 + @username) */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            type={u.avatar_type}
                            value={u.avatar_value}
                            fallbackName={u.display_name || u.username}
                            size="sm"
                          />
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {u.role === 'admin'
                                ? <Shield className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                : <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              }
                              <span className="font-medium text-gray-900 truncate">
                                {u.display_name || u.username}
                              </span>
                              {isMe && (
                                <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded font-medium">自分</span>
                              )}
                            </div>
                            {u.display_name && (
                              <span className="text-xs text-gray-500">@{u.username}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* ロール */}
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          u.role === 'admin'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {u.role === 'admin' ? '管理者' : '一般'}
                        </span>
                      </td>

                      {/* 最終ログイン */}
                      <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell tabular-nums">
                        {formatDate(u.last_login_at)}
                      </td>

                      {/* 有効/無効 */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => !isMe && handleToggle(u)}
                          disabled={isMe || toggling === u.id}
                          className={`transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                            u.is_active
                              ? 'text-green-500 hover:text-green-600'
                              : 'text-gray-300 hover:text-gray-400'
                          }`}
                          title={isMe ? '自分自身は変更できません' : u.is_active ? '無効にする' : '有効にする'}
                        >
                          {u.is_active
                            ? <ToggleRight className="w-6 h-6" />
                            : <ToggleLeft className="w-6 h-6" />
                          }
                        </button>
                      </td>

                      {/* 削除 */}
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => !isMe && setDeleteTarget(u)}
                          disabled={isMe}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={isMe ? '自分自身は削除できません' : '削除'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
            全 {users.length} 件（有効: {users.filter(u => u.is_active).length} 件）
          </div>
        </div>
      )}

      {/* ─── 削除確認モーダル ─────────────────────────────── */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="ユーザーの削除" size="sm">
        <p className="text-sm text-gray-700 mb-6">
          <strong className="text-gray-900">「{deleteTarget?.display_name || deleteTarget?.username}」</strong> を削除しますか？
          <br />
          <span className="text-gray-500">この操作は元に戻せません。</span>
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setDeleteTarget(null)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
          >
            削除する
          </button>
        </div>
      </Modal>
    </div>
  );
}
