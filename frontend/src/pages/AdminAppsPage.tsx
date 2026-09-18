import { useState, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  RefreshCw, AlertCircle, GripVertical,
} from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor,
  KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import Modal from '../components/Modal';
import AppFormModal from './AppFormModal';
import { fetchApps, deleteApp, updateApp, reorderApps } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import type { App } from '../types';

// ─── ドラッグ可能な行コンポーネント ──────────────────────────────
interface SortableRowProps {
  app: App;
  onEdit:   (app: App) => void;
  onDelete: (app: App) => void;
  onToggle: (app: App) => void;
}

function SortableRow({ app, onEdit, onDelete, onToggle }: SortableRowProps) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: app.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex:  isDragging ? 10 : undefined,
    position: isDragging ? 'relative' as const : undefined,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b border-gray-100 hover:bg-gray-50 transition-colors bg-white"
    >
      {/* ドラッグハンドル */}
      <td className="px-2 py-3 w-8">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 touch-none p-1 rounded"
          title="ドラッグして並び替え"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </td>

      {/* アプリ名 */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-2.5">
          {app.icon_type === 'emoji' && app.icon_value
            ? <span className="text-xl leading-none">{app.icon_value}</span>
            : (
              <div className="w-7 h-7 flex items-center justify-center bg-blue-100 rounded-lg text-blue-700 font-bold text-xs flex-shrink-0">
                {app.name.charAt(0).toUpperCase()}
              </div>
            )
          }
          <div>
            <div className="font-medium text-gray-900 text-sm">{app.name}</div>
            {app.description && (
              <div className="text-xs text-gray-400 truncate max-w-[180px]">{app.description}</div>
            )}
          </div>
        </div>
      </td>

      {/* URL */}
      <td className="px-3 py-3 hidden md:table-cell">
        <a
          href={app.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-xs text-blue-600 hover:underline truncate block max-w-[200px]"
        >
          {app.url}
        </a>
      </td>

      {/* カテゴリ */}
      <td className="px-3 py-3 hidden lg:table-cell">
        {app.category_name
          ? <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">{app.category_name}</span>
          : <span className="text-gray-300 text-xs">未分類</span>
        }
      </td>

      {/* 有効/無効 */}
      <td className="px-3 py-3 text-center">
        <button
          onClick={() => onToggle(app)}
          title={app.is_enabled ? '無効にする' : '有効にする'}
          className={`transition-colors ${app.is_enabled ? 'text-green-500 hover:text-green-600' : 'text-gray-300 hover:text-gray-400'}`}
        >
          {app.is_enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
        </button>
      </td>

      {/* 操作ボタン */}
      <td className="px-3 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onEdit(app)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            title="編集"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(app)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            title="削除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── メインページ ─────────────────────────────────────────────────
export default function AdminAppsPage() {
  const { toast } = useToast();

  const [apps, setApps]               = useState<App[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [editingApp, setEditingApp]   = useState<App | null>(null);
  const [isAddOpen, setIsAddOpen]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<App | null>(null);
  const [saving, setSaving]           = useState(false);

  // ─── DnD センサー設定 ─────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const loadApps = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApps();
      setApps(res.data ?? []);
    } catch {
      setError('アプリ一覧の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadApps(); }, []);

  // ─── ドラッグ終了 → 並び順を更新 ─────────────────────────────
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = apps.findIndex(a => a.id === active.id);
    const newIndex = apps.findIndex(a => a.id === over.id);
    const reordered = arrayMove(apps, oldIndex, newIndex);

    // 楽観的UI更新（先に画面を更新してからAPIを叩く）
    setApps(reordered);

    try {
      await reorderApps(reordered.map((a, i) => ({ id: a.id, display_order: i + 1 })));
      toast('表示順を保存しました');
    } catch {
      toast('表示順の保存に失敗しました', 'error');
      loadApps(); // ロールバック
    }
  };

  // ─── 有効/無効切替 ──────────────────────────────────────────────
  const handleToggle = async (app: App) => {
    try {
      await updateApp(app.id, {
        name: app.name, description: app.description ?? '',
        url: app.url, icon_type: app.icon_type, icon_value: app.icon_value ?? '',
        category_id: app.category_id, display_order: app.display_order,
        is_enabled: app.is_enabled === 1 ? 0 : 1,
      });
      toast(app.is_enabled ? 'アプリを無効にしました' : 'アプリを有効にしました');
      loadApps();
    } catch {
      toast('状態の更新に失敗しました', 'error');
    }
  };

  // ─── 削除 ───────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteApp(deleteTarget.id);
      toast(`「${deleteTarget.name}」を削除しました`);
      setDeleteTarget(null);
      loadApps();
    } catch {
      toast('削除に失敗しました', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ─── ヘッダー ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">アプリ管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            HUBに表示するアプリを管理します。行をドラッグして並び替えられます。
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm flex-shrink-0 self-start"
        >
          <Plus className="w-4 h-4" />
          アプリ追加
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">読み込み中...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* ─── テーブル（DnD対応）───────────────────────────── */}
      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={apps.map(a => a.id)} strategy={verticalListSortingStrategy}>
              {/* 狭い画面では横スクロールで逃がす */}
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[340px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left">
                    <th className="px-2 py-3 w-8"></th>
                    <th className="px-3 py-3 font-semibold text-gray-600">アプリ名</th>
                    <th className="px-3 py-3 font-semibold text-gray-600 hidden md:table-cell">URL</th>
                    <th className="px-3 py-3 font-semibold text-gray-600 hidden lg:table-cell">カテゴリ</th>
                    <th className="px-3 py-3 font-semibold text-gray-600 text-center w-20">状態</th>
                    <th className="px-3 py-3 font-semibold text-gray-600 text-right w-24">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-14 text-gray-400 text-sm">
                        登録されているアプリがありません
                      </td>
                    </tr>
                  ) : (
                    apps.map(app => (
                      <SortableRow
                        key={app.id}
                        app={app}
                        onEdit={setEditingApp}
                        onDelete={setDeleteTarget}
                        onToggle={handleToggle}
                      />
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </SortableContext>
          </DndContext>
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
            全 {apps.length} 件
          </div>
        </div>
      )}

      {/* ─── 追加/編集モーダル ─────────────────────────────── */}
      <AppFormModal
        isOpen={isAddOpen || !!editingApp}
        app={editingApp}
        onClose={() => { setIsAddOpen(false); setEditingApp(null); }}
        onSaved={() => { loadApps(); toast(editingApp ? 'アプリを更新しました' : 'アプリを追加しました'); }}
      />

      {/* ─── 削除確認モーダル ──────────────────────────────── */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="アプリの削除" size="sm">
        <p className="text-sm text-gray-700 mb-6">
          <strong className="text-gray-900">「{deleteTarget?.name}」</strong> を削除しますか？
          <br /><span className="text-gray-400">この操作は元に戻せません。</span>
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
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60"
          >
            削除する
          </button>
        </div>
      </Modal>
    </div>
  );
}
