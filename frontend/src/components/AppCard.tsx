import { ExternalLink, Copy, Heart } from 'lucide-react';
import type { App } from '../types';
import { useToast } from '../contexts/ToastContext';

/** アプリアイコン表示コンポーネント */
function AppIcon({ app }: { app: App }) {
  if (app.icon_type === 'emoji' && app.icon_value) {
    return (
      <div className="w-12 h-12 flex items-center justify-center text-3xl flex-shrink-0">
        {app.icon_value}
      </div>
    );
  }
  if ((app.icon_type === 'url' || app.icon_type === 'upload') && app.icon_value) {
    return (
      <img
        src={app.icon_value}
        alt={`${app.name} icon`}
        className="w-12 h-12 object-contain rounded-lg flex-shrink-0"
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl text-white text-xl font-bold shadow-sm flex-shrink-0">
      {app.name.charAt(0).toUpperCase()}
    </div>
  );
}

interface AppCardProps {
  app: App;
  /** true のときクリックでURLを開く動作を無効化（並び替えモード用） */
  disableClick?: boolean;
  /** お気に入り状態 */
  isFavorite?: boolean;
  /** カードクリック時のコールバック（未指定時は window.open） */
  onOpen?: (app: App) => void;
  /** お気に入りトグルコールバック（未指定時はボタン非表示） */
  onToggleFavorite?: (e: React.MouseEvent, app: App) => void;
}

export default function AppCard({
  app,
  disableClick = false,
  isFavorite = false,
  onOpen,
  onToggleFavorite,
}: AppCardProps) {
  const { toast } = useToast();

  const handleOpen = () => {
    if (disableClick) return;
    if (onOpen) {
      onOpen(app);
    } else {
      window.open(app.url, '_blank', 'noopener,noreferrer');
    }
  };

  /** URLをクリップボードにコピー（カードクリックは発火させない） */
  const handleCopyUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(app.url)
      .then(() => toast(`URLをコピーしました`, 'success'))
      .catch(() => toast('コピーに失敗しました', 'error'));
  };

  return (
    <div
      onClick={handleOpen}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleOpen()}
      role="button"
      tabIndex={0}
      aria-label={`${app.name} を開く`}
      className={`
        group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4
        transition-all duration-200 flex flex-col gap-3
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
        ${disableClick
          ? 'cursor-grab active:cursor-grabbing select-none'
          : 'hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md active:scale-[0.98] cursor-pointer'
        }
      `}
    >
      {/* アイコン + タイトル行 */}
      <div className="flex items-center gap-3">
        <AppIcon app={app} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
              {app.name}
            </h3>
            <ExternalLink className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          {app.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
              {app.description}
            </p>
          )}
        </div>
      </div>

      {/* カテゴリ + お気に入り + コピーボタン行 */}
      <div className="flex items-center justify-between gap-2">
        <div>
          {app.category_name && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
              {app.category_name}
            </span>
          )}
        </div>
        {!disableClick && (
          <div className="flex items-center gap-0.5">
            {/* お気に入りボタン */}
            {onToggleFavorite && (
              <button
                onClick={e => onToggleFavorite(e, app)}
                title={isFavorite ? 'お気に入りから削除' : 'お気に入りに追加'}
                className={`p-2 -m-0.5 rounded transition-all flex-shrink-0 ${
                  isFavorite
                    ? 'text-pink-500 opacity-100'
                    : 'opacity-0 group-hover:opacity-100 touch-always-visible text-gray-300 hover:text-pink-400'
                }`}
                aria-label={isFavorite ? 'お気に入りから削除' : 'お気に入りに追加'}
              >
                <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
            )}
            {/* URLコピーボタン（ホバー時のみ） */}
            <button
              onClick={handleCopyUrl}
              title={`URLをコピー: ${app.url}`}
              className="
                opacity-0 group-hover:opacity-100 touch-always-visible transition-opacity
                p-2 -m-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100
                flex-shrink-0
              "
              aria-label="URLをコピー"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
