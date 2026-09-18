import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClass = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const;

/**
 * 汎用モーダルコンポーネント
 * - Escキーで閉じる
 * - 背景クリックで閉じる
 * - スクロール対応
 */
export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  // Escキーで閉じる
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // モーダル表示中はbodyスクロールをロック
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        className={`bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full ${sizeClass[size]} max-h-[85vh] sm:max-h-[90vh] flex flex-col pb-safe`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 id="modal-title" className="text-base font-semibold text-gray-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors rounded-md p-2 -mr-1 hover:bg-gray-100"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ボディ（スクロール可） */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
