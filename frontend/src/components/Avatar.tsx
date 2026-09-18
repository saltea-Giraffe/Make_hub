import { useState, useEffect } from 'react';

export type AvatarType = 'emoji' | 'url' | 'upload' | 'initial';

interface AvatarProps {
  type: AvatarType;
  value: string | null;
  /** initial モード時のフォールバック元となる文字列（表示名 or ユーザー名） */
  fallbackName: string;
  /** 画像/絵文字のサイズ (Tailwind の w-/h- と font-size を連動させるため数値で受ける) */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, { box: string; emoji: string; initial: string }> = {
  xs: { box: 'w-6 h-6',   emoji: 'text-sm',  initial: 'text-xs'  },
  sm: { box: 'w-8 h-8',   emoji: 'text-lg',  initial: 'text-sm'  },
  md: { box: 'w-10 h-10', emoji: 'text-2xl', initial: 'text-base' },
  lg: { box: 'w-12 h-12', emoji: 'text-3xl', initial: 'text-lg'  },
  xl: { box: 'w-20 h-20', emoji: 'text-5xl', initial: 'text-3xl' },
};

export default function Avatar({ type, value, fallbackName, size = 'sm', className = '' }: AvatarProps) {
  const s = SIZE_CLASSES[size];
  const base = `${s.box} flex-shrink-0 rounded-full flex items-center justify-center overflow-hidden ${className}`;

  // 画像の読み込みに失敗したら頭文字フォールバックへ切り替える
  const [imgError, setImgError] = useState(false);
  useEffect(() => { setImgError(false); }, [value]);

  if (type === 'emoji' && value) {
    return <div className={`${base} bg-gray-100 dark:bg-gray-700 ${s.emoji}`}>{value}</div>;
  }

  if ((type === 'url' || type === 'upload') && value && !imgError) {
    return (
      <img
        src={value}
        alt={`${fallbackName} avatar`}
        className={`${base} object-cover bg-gray-100 dark:bg-gray-700`}
        onError={() => setImgError(true)}
      />
    );
  }

  // initial / フォールバック
  const char = (fallbackName || '?').charAt(0).toUpperCase();
  return (
    <div className={`${base} bg-gradient-to-br from-blue-500 to-blue-700 text-white font-bold ${s.initial}`}>
      {char}
    </div>
  );
}
