import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, LayoutGrid, RefreshCw, X, GripVertical, ArrowUpDown, Check, Heart, Star } from 'lucide-react';
import {
  DndContext, closestCenter, MouseSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent, DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext, rectSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import AppCard from '../components/AppCard';
import AnnouncementBanner from '../components/AnnouncementBanner';
import { fetchApps, fetchCategories, reorderApps, fetchFavorites, addFavorite, removeFavorite, logAccess } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import type { App, Category } from '../types';

// ─── ドラッグ可能カードラッパー ───────────────────────────────────
function SortableCard({ app }: { app: App }) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: app.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
        zIndex: isDragging ? 50 : undefined,
      }}
      {...attributes}
      {...listeners}
    >
      <AppCard app={app} disableClick />
    </div>
  );
}

// ─── メインページ ─────────────────────────────────────────────────
export default function HubPage() {
  const { isAdmin, isAuthenticated } = useAuth();
  const { toast }   = useToast();

  const [apps, setApps]             = useState<App[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch]         = useState('');
  const [activeCat, setActiveCat]   = useState<number | 'all' | 'favorites'>('all');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [sortMode, setSortMode]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [activeApp, setActiveApp]   = useState<App | null>(null);
  const [favorites, setFavorites]   = useState<Set<number>>(new Set());

  // マウスは少し動かしたら、タッチは長押しで並び替え開始。
  // タッチを遅延起動にすることで、カードの上でも通常どおりスクロールできる。
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [appsRes, catsRes] = await Promise.all([
        fetchApps({ enabled_only: true }),
        fetchCategories(),
      ]);
      setApps(appsRes.data ?? []);
      setCategories(catsRes.data ?? []);
    } catch {
      setError('データの読み込みに失敗しました。バックエンドが起動しているか確認してください。');
    } finally {
      setLoading(false);
    }
  };

  const loadFavorites = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetchFavorites();
      setFavorites(new Set(res.data ?? []));
    } catch {/* サイレント */}
  }, [isAuthenticated]);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { loadFavorites(); }, [loadFavorites]);

  const handleToggleFavorite = async (e: React.MouseEvent, app: App) => {
    e.stopPropagation();
    const isFav = favorites.has(app.id);
    // 楽観的更新
    setFavorites(prev => {
      const next = new Set(prev);
      isFav ? next.delete(app.id) : next.add(app.id);
      return next;
    });
    try {
      if (isFav) {
        await removeFavorite(app.id);
      } else {
        await addFavorite(app.id);
        toast(`「${app.name}」をお気に入りに追加しました`, 'success');
      }
    } catch {
      // ロールバック
      setFavorites(prev => {
        const next = new Set(prev);
        isFav ? next.add(app.id) : next.delete(app.id);
        return next;
      });
      toast('お気に入りの更新に失敗しました', 'error');
    }
  };

  const handleAppOpen = async (app: App) => {
    if (isAuthenticated) {
      logAccess(app.id).catch(() => {/* サイレント */});
    }
    window.open(app.url, '_blank', 'noopener,noreferrer');
  };

  // 並び替えモードを抜けるときに検索・フィルタをリセット
  const enterSortMode = () => {
    setSearch('');
    setActiveCat('all');
    setSortMode(true);
  };

  // ─── ドラッグ中: アクティブカードを記録（DragOverlay用）──────
  const handleDragStart = (event: { active: { id: number | string } }) => {
    const found = apps.find(a => a.id === event.active.id);
    setActiveApp(found ?? null);
  };

  // ─── ドラッグ終了: ローカル順序を更新 ────────────────────────
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveApp(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = apps.findIndex(a => a.id === active.id);
    const newIndex = apps.findIndex(a => a.id === over.id);
    setApps(prev => arrayMove(prev, oldIndex, newIndex));
  };

  // ─── 保存ボタン ────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await reorderApps(apps.map((a, i) => ({ id: a.id, display_order: i + 1 })));
      toast('表示順を保存しました');
      setSortMode(false);
    } catch {
      toast('保存に失敗しました', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ─── キャンセル: サーバーから再取得してリセット ──────────────
  const handleCancel = () => {
    setSortMode(false);
    loadData();
  };

  // ─── 通常表示用フィルタ・グループ ────────────────────────────
  const filteredApps = useMemo(() => {
    if (sortMode) return apps;
    const q = search.toLowerCase();
    return apps.filter(app => {
      const matchSearch = !q ||
        app.name.toLowerCase().includes(q) ||
        (app.description?.toLowerCase().includes(q) ?? false);
      const matchCat =
        activeCat === 'all' ? true :
        activeCat === 'favorites' ? favorites.has(app.id) :
        app.category_id === activeCat;
      return matchSearch && matchCat;
    });
  }, [apps, search, activeCat, sortMode, favorites]);

  const grouped = useMemo(() => {
    if (sortMode || activeCat !== 'all') {
      return [{ label: null, apps: filteredApps }];
    }
    const map = new Map<string, App[]>();
    for (const app of filteredApps) {
      const key = app.category_name ?? '未分類';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(app);
    }
    return Array.from(map.entries()).map(([label, apps]) => ({ label, apps }));
  }, [filteredApps, activeCat, sortMode]);

  const favCount = favorites.size;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 dark:text-gray-100">

      {/* ─── お知らせバナー ───────────────────────────────────── */}
      {isAuthenticated && <AnnouncementBanner />}

      {/* ─── ページヘッダー + 検索 ─────────────────────────── */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-1">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">ショートカット</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">よく使うサービス・ツールへのリンク一覧です</p>
          </div>

          {/* 並び替えモードボタン（管理者のみ） */}
          {isAdmin && !loading && !error && (
            sortMode ? (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleCancel}
                  className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 sm:py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
                >
                  <Check className="w-4 h-4" />
                  {saving ? '保存中...' : '順番を保存'}
                </button>
              </div>
            ) : (
              <button
                onClick={enterSortMode}
                className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex-shrink-0 self-start sm:self-auto"
              >
                <ArrowUpDown className="w-4 h-4" />
                並び替え
              </button>
            )
          )}
        </div>

        {/* 並び替えモード中のヒントバナー */}
        {sortMode && (
          <div className="flex items-start gap-2 mt-4 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            <GripVertical className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>カードをドラッグ（スマートフォンでは長押ししてからドラッグ）して並び替え、「順番を保存」で確定します</span>
          </div>
        )}

        {/* 検索（並び替えモード中は非表示） */}
        {!sortMode && (
          <div className="relative max-w-md mt-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="アプリ名・説明文で検索..."
              className="w-full pl-9 pr-8 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm dark:text-gray-100 dark:placeholder-gray-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                aria-label="検索をクリア"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── カテゴリフィルタ（並び替えモード中は非表示）──── */}
      {!sortMode && (
        <div className="flex items-center gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0 mb-6">
          <button
            onClick={() => setActiveCat('all')}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              activeCat === 'all'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            すべて ({apps.length})
          </button>
          {/* お気に入りフィルタ（ログインユーザーのみ） */}
          {isAuthenticated && (
            <button
              onClick={() => setActiveCat('favorites')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeCat === 'favorites'
                  ? 'bg-pink-500 text-white border-pink-500'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              お気に入り ({favCount})
            </button>
          )}
          {categories.map(cat => {
            const count = apps.filter(a => a.category_id === cat.id).length;
            if (count === 0) return null;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  activeCat === cat.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* ─── ロード中 / エラー ─────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">読み込み中...</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm">
          {error}
          <button onClick={loadData} className="ml-3 underline font-medium hover:no-underline">
            再試行
          </button>
        </div>
      )}

      {/* ─── アプリ一覧 ───────────────────────────────────── */}
      {!loading && !error && (
        filteredApps.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <LayoutGrid className="w-12 h-12 mx-auto mb-3 opacity-30" />
            {activeCat === 'favorites' ? (
              <>
                <p className="font-medium text-gray-500">お気に入りはまだありません</p>
                <p className="text-sm mt-1">アプリカードのハートアイコンでお気に入り登録できます</p>
              </>
            ) : (
              <>
                <p className="font-medium text-gray-500">該当するアプリが見つかりません</p>
                {search && (
                  <p className="text-sm mt-1">「{search}」を含むアプリは登録されていません</p>
                )}
              </>
            )}
          </div>
        ) : sortMode ? (
          // ══════════ 並び替えモード ══════════
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={apps.map(a => a.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {apps.map(app => (
                  <SortableCard key={app.id} app={app} />
                ))}
              </div>
            </SortableContext>

            {/* ドラッグ中のゴースト表示 */}
            <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
              {activeApp && (
                <div className="rotate-2 scale-105 shadow-2xl ring-2 ring-blue-400 rounded-xl opacity-95">
                  <AppCard app={activeApp} disableClick />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : (
          // ══════════ 通常表示モード ══════════
          grouped.map(({ label, apps: groupApps }) => (
            <div key={label ?? '__all__'} className="mb-8">
              {label && (
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {label}
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              )}
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {groupApps.map(app => (
                  <AppCard
                    key={app.id}
                    app={app}
                    isFavorite={favorites.has(app.id)}
                    onOpen={handleAppOpen}
                    onToggleFavorite={isAuthenticated ? handleToggleFavorite : undefined}
                  />
                ))}
              </div>
            </div>
          ))
        )
      )}

      {/* お気に入りヒント（ログイン済みかつ favorites=0） */}
      {isAuthenticated && !loading && !error && favCount === 0 && activeCat !== 'favorites' && (
        <div className="mt-8 flex items-center gap-2 text-xs text-gray-400">
          <Star className="w-3.5 h-3.5" />
          カードの <Heart className="w-3 h-3 inline" /> をクリックしてお気に入り登録できます
        </div>
      )}
    </div>
  );
}
