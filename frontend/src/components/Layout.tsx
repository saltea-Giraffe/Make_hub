import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid, Settings, Tag, LogOut, User, ChevronDown, KeyRound, Users,
  Sun, Moon, Megaphone, BarChart2, UserCircle, Menu, X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Avatar from './Avatar';

/** 管理者向けナビゲーション項目（PCヘッダーとモバイルメニューで共用） */
const ADMIN_NAV = [
  { to: '/admin/apps',          icon: Settings,  label: 'アプリ'   },
  { to: '/admin/categories',    icon: Tag,       label: 'カテゴリ' },
  { to: '/admin/users',         icon: Users,     label: 'ユーザー' },
  { to: '/admin/announcements', icon: Megaphone, label: 'お知らせ' },
  { to: '/admin/access-log',    icon: BarChart2, label: 'ログ'     },
] as const;

export default function Layout() {
  const { isAuthenticated, isAdmin, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen]     = useState(false);  // PC: ユーザードロップダウン
  const [mobileOpen, setMobileOpen] = useState(false);  // モバイル: ハンバーガーメニュー
  const menuRef = useRef<HTMLDivElement>(null);

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 画面遷移したらモバイルメニューを閉じる
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // モバイルメニューを開いている間は背面のスクロールを止める
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mobileOpen]);

  // PCヘッダー用（md以上で表示・ラベルはlg以上）
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
    }`;

  // モバイルメニュー用（指でタップしやすいよう縦に余裕をもたせる）
  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors ${
      isActive
        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
    }`;

  const handleLogout = () => {
    setMenuOpen(false);
    setMobileOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* ─── ヘッダー ─────────────────────────────────────── */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 px-safe">
          <div className="flex items-center justify-between h-14">
            {/* ロゴ */}
            <Link
              to="/"
              className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity min-w-0"
            >
              <LayoutGrid className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">Make HUB</span>
            </Link>

            {/* ─── PC用ナビゲーション（md未満はハンバーガーに畳む）─── */}
            <div className="hidden md:flex items-center gap-1">
              <nav className="flex items-center gap-1">
                <NavLink to="/" end className={navLinkClass} title="HUB">
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden lg:inline">HUB</span>
                </NavLink>

                {isAdmin && ADMIN_NAV.map(({ to, icon: Icon, label }) => (
                  <NavLink key={to} to={to} className={navLinkClass} title={label}>
                    <Icon className="w-4 h-4" />
                    <span className="hidden lg:inline">{label}</span>
                  </NavLink>
                ))}
              </nav>

              {/* ダークモードトグル */}
              <button
                onClick={toggleTheme}
                title={theme === 'dark' ? 'ライトモードへ切り替え' : 'ダークモードへ切り替え'}
                className="p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                aria-label="テーマ切り替え"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* ユーザーメニュー */}
              <div className="ml-1 pl-2 border-l border-gray-200 dark:border-gray-600">
                {isAuthenticated ? (
                  <div className="relative" ref={menuRef}>
                    <button
                      onClick={() => setMenuOpen(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      <Avatar
                        type={user?.avatar_type ?? 'initial'}
                        value={user?.avatar_value ?? null}
                        fallbackName={user?.display_name || user?.username || '?'}
                        size="xs"
                      />
                      <span className="hidden lg:inline max-w-[100px] truncate">
                        {user?.display_name || user?.username}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* ドロップダウンメニュー */}
                    {menuOpen && (
                      <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg py-1 z-50">
                        {/* ユーザー情報 */}
                        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {user?.display_name || user?.username}
                          </p>
                          {user?.display_name && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">@{user.username}</p>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {user?.role === 'admin' ? '管理者' : '一般ユーザー'}
                          </p>
                        </div>

                        {/* プロフィール */}
                        <button
                          onClick={() => { setMenuOpen(false); navigate('/profile'); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <UserCircle className="w-4 h-4 text-gray-400" />
                          プロフィール
                        </button>

                        {/* パスワード変更 */}
                        <button
                          onClick={() => { setMenuOpen(false); navigate('/change-password'); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <KeyRound className="w-4 h-4 text-gray-400" />
                          パスワード変更
                        </button>

                        {/* ログアウト */}
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          ログアウト
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <NavLink
                    to="/login"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    <User className="w-4 h-4" />
                    <span className="hidden lg:inline">ログイン</span>
                  </NavLink>
                )}
              </div>
            </div>

            {/* ─── モバイル用: テーマ切替＋ハンバーガー ─── */}
            <div className="flex md:hidden items-center gap-1">
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                aria-label="テーマ切り替え"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setMobileOpen(v => !v)}
                className="p-2.5 rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                aria-label={mobileOpen ? 'メニューを閉じる' : 'メニューを開く'}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* ─── モバイルメニュー本体 ───────────────────────── */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 max-h-[calc(100vh-3.5rem)] overflow-y-auto pb-safe px-safe">
            <nav className="px-3 py-3 space-y-1">
              <NavLink to="/" end className={mobileLinkClass}>
                <LayoutGrid className="w-5 h-5" />
                HUB
              </NavLink>

              {isAdmin && (
                <>
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    管理
                  </p>
                  {ADMIN_NAV.map(({ to, icon: Icon, label }) => (
                    <NavLink key={to} to={to} className={mobileLinkClass}>
                      <Icon className="w-5 h-5" />
                      {label}
                    </NavLink>
                  ))}
                </>
              )}
            </nav>

            {/* ユーザーセクション */}
            <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-3 space-y-1">
              {isAuthenticated ? (
                <>
                  <div className="flex items-center gap-3 px-4 py-2">
                    <Avatar
                      type={user?.avatar_type ?? 'initial'}
                      value={user?.avatar_value ?? null}
                      fallbackName={user?.display_name || user?.username || '?'}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {user?.display_name || user?.username}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {user?.role === 'admin' ? '管理者' : '一般ユーザー'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate('/profile')}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <UserCircle className="w-5 h-5 text-gray-400" />
                    プロフィール
                  </button>
                  <button
                    onClick={() => navigate('/change-password')}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <KeyRound className="w-5 h-5 text-gray-400" />
                    パスワード変更
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    ログアウト
                  </button>
                </>
              ) : (
                <NavLink to="/login" className={mobileLinkClass}>
                  <User className="w-5 h-5" />
                  ログイン
                </NavLink>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ─── メインコンテンツ ──────────────────────────────── */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* ─── フッター ─────────────────────────────────────── */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 py-3 pb-safe">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-gray-400">
          Make HUB &nbsp;v{__APP_VERSION__} &nbsp;&copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
