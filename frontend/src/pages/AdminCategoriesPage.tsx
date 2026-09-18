import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Check, X, RefreshCw, Tag } from 'lucide-react';
import Modal from '../components/Modal';
import { fetchCategories, createCategory, updateCategory, deleteCategory } from '../api/client';
import type { Category } from '../types';

/**
 * カテゴリ管理画面
 * インライン編集対応（行クリックで編集モードに切替）
 */
export default function AdminCategoriesPage() {
  const [categories, setCategories]   = useState<Category[]>([]);
  const [loading, setLoading]         = useState(true);
  const [editingId, setEditingId]     = useState<number | null>(null);
  const [editName, setEditName]       = useState('');
  const [editOrder, setEditOrder]     = useState(0);
  const [isAdding, setIsAdding]       = useState(false);
  const [newName, setNewName]         = useState('');
  const [newOrder, setNewOrder]       = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [error, setError]             = useState<string | null>(null);

  const loadCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCategories();
      setCategories(res.data ?? []);
    } catch {
      setError('カテゴリの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCategories(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await createCategory({ name: newName.trim(), display_order: newOrder });
      setIsAdding(false);
      setNewName('');
      setNewOrder(0);
      loadCategories();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg ?? 'カテゴリの追加に失敗しました');
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editName.trim()) return;
    try {
      await updateCategory(id, { name: editName.trim(), display_order: editOrder });
      setEditingId(null);
      loadCategories();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg ?? 'カテゴリの更新に失敗しました');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCategory(deleteTarget.id);
      setDeleteTarget(null);
      loadCategories();
    } catch {
      alert('カテゴリの削除に失敗しました');
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditOrder(cat.display_order);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ─── ページヘッダー ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">カテゴリ管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">アプリを分類するカテゴリの追加・編集・削除</p>
        </div>
        <button
          onClick={() => { setIsAdding(true); setNewName(''); setNewOrder(0); }}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm flex-shrink-0 self-start"
        >
          <Plus className="w-4 h-4" />
          カテゴリ追加
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">読み込み中...</span>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {/* 追加行 */}
          {isAdding && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-4 py-3 bg-blue-50 border-b border-blue-100">
              <Tag className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="新しいカテゴリ名"
                autoFocus
                maxLength={50}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setIsAdding(false); }}
                className="flex-1 min-w-[10rem] px-3 py-1.5 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">順:</span>
                <input
                  type="number"
                  value={newOrder}
                  onChange={e => setNewOrder(Number(e.target.value))}
                  min={0}
                  className="w-16 px-2 py-1.5 border border-blue-300 rounded-md text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleAdd}
                className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-md transition-colors"
                title="追加"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                title="キャンセル"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[320px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">カテゴリ名</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-center w-24">表示順</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-right w-28">操作</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-16 text-gray-400">
                    <Tag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>カテゴリが登録されていません</p>
                  </td>
                </tr>
              ) : (
                categories.map(cat => (
                  <tr key={cat.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    {/* カテゴリ名（インライン編集） */}
                    <td className="px-4 py-3">
                      {editingId === cat.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          autoFocus
                          maxLength={50}
                          onKeyDown={e => { if (e.key === 'Enter') handleUpdate(cat.id); if (e.key === 'Escape') setEditingId(null); }}
                          className="px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full max-w-xs"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="font-medium text-gray-800">{cat.name}</span>
                        </div>
                      )}
                    </td>

                    {/* 表示順 */}
                    <td className="px-4 py-3 text-center">
                      {editingId === cat.id ? (
                        <input
                          type="number"
                          value={editOrder}
                          onChange={e => setEditOrder(Number(e.target.value))}
                          min={0}
                          className="w-16 px-2 py-1 border border-blue-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <span className="text-gray-400 tabular-nums">{cat.display_order}</span>
                      )}
                    </td>

                    {/* 操作 */}
                    <td className="px-4 py-3 text-right">
                      {editingId === cat.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleUpdate(cat.id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                            title="保存"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md transition-colors"
                            title="キャンセル"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => startEdit(cat)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="編集"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(cat)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>

          {categories.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
              全 {categories.length} カテゴリ
            </div>
          )}
        </div>
      )}

      {/* ─── 削除確認モーダル ─────────────────────────────── */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="カテゴリの削除"
        size="sm"
      >
        <div className="text-sm text-gray-700 mb-6">
          <p>
            <strong className="text-gray-900">「{deleteTarget?.name}」</strong> を削除しますか？
          </p>
          <p className="mt-2 text-gray-500 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs">
            ⚠️ このカテゴリに属するアプリは「未分類」になります。アプリ自体は削除されません。
          </p>
        </div>
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
