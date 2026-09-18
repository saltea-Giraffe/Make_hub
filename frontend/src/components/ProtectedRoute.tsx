import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from './LoadingScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** true の場合、admin ロールのみ通過 */
  requireAdmin?: boolean;
}

/**
 * 認証・権限チェックルートラッパー
 * - 未認証 → /login にリダイレクト（元のURLをstateで保持）
 * - 権限不足 → / にリダイレクト
 * - 認証チェック中 → ローディング表示
 */
export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;

  if (!isAuthenticated) {
    // ログイン後に元のページに戻れるよう from を保持
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
