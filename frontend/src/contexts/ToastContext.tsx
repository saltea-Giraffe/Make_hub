import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

// ─── 型 ───────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

// ─── Context ──────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

// ─── Provider ─────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++nextId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const dismiss = (id: number) =>
    setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* ─── トースト表示エリア（右下固定）─────────────────── */}
      <div
        aria-live="polite"
        className="fixed z-[100] flex flex-col gap-2 pointer-events-none inset-x-3 bottom-3 sm:inset-x-auto sm:right-5 sm:bottom-5 pb-safe"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
              pointer-events-auto w-full sm:w-auto sm:min-w-[220px] sm:max-w-xs
              animate-[fadeSlideIn_0.2s_ease-out]
              ${t.type === 'success' ? 'bg-gray-900 text-white' :
                t.type === 'error'   ? 'bg-red-600 text-white' :
                                       'bg-blue-600 text-white'}`}
          >
            {t.type === 'success' && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
            {t.type === 'error'   && <XCircle     className="w-4 h-4 flex-shrink-0" />}
            {t.type === 'info'    && <Info         className="w-4 h-4 flex-shrink-0" />}
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="text-white/70 hover:text-white flex-shrink-0 p-1 -m-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
