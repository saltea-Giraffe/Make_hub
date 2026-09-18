import { useEffect, useState } from 'react';
import { Info, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { fetchAnnouncements } from '../api/client';
import type { Announcement } from '../types';

const typeConfig = {
  info:    { icon: Info,          bg: 'bg-blue-50',   border: 'border-blue-200',  text: 'text-blue-800',  iconClass: 'text-blue-500'  },
  warning: { icon: AlertTriangle, bg: 'bg-yellow-50', border: 'border-yellow-200',text: 'text-yellow-800',iconClass: 'text-yellow-500' },
  success: { icon: CheckCircle,   bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-800', iconClass: 'text-green-500'  },
};

export default function AnnouncementBanner() {
  const [items, setItems]     = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchAnnouncements()
      .then(r => setItems(r.data ?? []))
      .catch(() => {/* サイレント失敗 */});
  }, []);

  const visible = items.filter(a => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {visible.map(a => {
        const cfg = typeConfig[a.type] ?? typeConfig.info;
        const Icon = cfg.icon;
        return (
          <div
            key={a.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${cfg.bg} ${cfg.border}`}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${cfg.iconClass}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${cfg.text}`}>{a.title}</p>
              {a.content && (
                <p className={`text-sm mt-0.5 ${cfg.text} opacity-80`}>{a.content}</p>
              )}
            </div>
            <button
              onClick={() => setDismissed(prev => new Set(prev).add(a.id))}
              className={`flex-shrink-0 p-0.5 rounded hover:bg-black/10 ${cfg.iconClass}`}
              aria-label="閉じる"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
