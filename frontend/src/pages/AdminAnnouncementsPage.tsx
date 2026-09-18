import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import {
  fetchAllAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
} from '../api/client';
import { useToast } from '../contexts/ToastContext';
import type { Announcement } from '../types';

const TYPE_OPTIONS: { value: Announcement['type']; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'info',    label: 'お知らせ', icon: Info,          color: 'text-blue-600'   },
  { value: 'warning', label: '注意',     icon: AlertTriangle, color: 'text-yellow-600' },
  { value: 'success', label: '完了',     icon: CheckCircle,   color: 'text-green-600'  },
];

const emptyForm = (): Partial<Announcement> => ({
  title: '', content: '', type: 'info', is_active: 1, display_order: 0,
});

export default function AdminAnnouncementsPage() {
  const { toast } = useToast();
  const [items, setItems]   = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Announcement> & { id?: number } | null>(null);
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    fetchAllAnnouncements()
      .then(r => setItems(r.data ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSave = async () => {
    if (!editing?.title?.trim()) { toast('タイトルは必須です', 'error'); return; }
    setSaving(true);
    try {
      if (editing.id) {
        await updateAnnouncement(editing.id, editing);
        toast('お知らせを更新しました');
      } else {
        await createAnnouncement(editing);
        toast('お知らせを作成しました', 'success');
      }
      setEditing(null);
      load();
    } catch {
      toast('保存に失敗しました', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (a: Announcement) => {
    try {
      await updateAnnouncement(a.id, { ...a, is_active: a.is_active ? 0 : 1 });
      load();
    } catch {
      toast('更新に失敗しました', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try {
      await deleteAnnouncement(id);
      toast('削除しました');
      load();
    } catch {
      toast('削除に失敗しました', 'error');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">お知らせ管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">HUBトップに表示するお知らせを管理します</p>
        </div>
        <button
          onClick={() => setEditing(emptyForm())}
          className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex-shrink-0 self-start"
        >
          <Plus className="w-4 h-4" /> 新規作成
        </button>
      </div>

      {/* ─── フォーム ─────────────────────────────── */}
      {editing && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            {editing.id ? 'お知らせを編集' : '新規お知らせ'}
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">タイトル *</label>
              <input
                type="text"
                value={editing.title ?? ''}
                onChange={e => setEditing(f => ({ ...f!, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: システムメンテナンスのお知らせ"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">本文（省略可）</label>
              <textarea
                value={editing.content ?? ''}
                onChange={e => setEditing(f => ({ ...f!, content: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="詳細内容を入力..."
              />
            </div>
            <div className="flex flex-wrap items-start gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">種別</label>
                <div className="flex flex-wrap gap-2">
                  {TYPE_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEditing(f => ({ ...f!, type: opt.value }))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          editing.type === opt.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${opt.color}`} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">表示順</label>
                <input
                  type="number"
                  value={editing.display_order ?? 0}
                  onChange={e => setEditing(f => ({ ...f!, display_order: Number(e.target.value) }))}
                  className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2 pt-0 sm:pt-4">
                <label className="text-xs font-medium text-gray-600">有効</label>
                <input
                  type="checkbox"
                  checked={editing.is_active === 1}
                  onChange={e => setEditing(f => ({ ...f!, is_active: e.target.checked ? 1 : 0 }))}
                  className="rounded"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              onClick={() => setEditing(null)}
              className="px-4 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* ─── 一覧 ─────────────────────────────────── */}
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">読み込み中...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">お知らせはありません</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[340px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">タイトル</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-20">種別</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 w-16">有効</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-24">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(a => {
                const opt = TYPE_OPTIONS.find(t => t.value === a.type) ?? TYPE_OPTIONS[0];
                const Icon = opt.icon;
                return (
                  <tr key={a.id} className={`hover:bg-gray-50 ${a.is_active ? '' : 'opacity-50'}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{a.title}</p>
                      {a.content && <p className="text-xs text-gray-400 truncate max-w-xs">{a.content}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs font-medium ${opt.color}`}>
                        <Icon className="w-3.5 h-3.5" />{opt.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleToggle(a)} className="text-gray-400 hover:text-gray-600">
                        {a.is_active
                          ? <ToggleRight className="w-5 h-5 text-blue-500" />
                          : <ToggleLeft className="w-5 h-5" />
                        }
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditing(a)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(a.id)}
                          disabled={deleting === a.id}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
