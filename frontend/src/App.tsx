import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingScreen from './components/LoadingScreen';
import HubPage from './pages/HubPage';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import SsoCallbackPage from './pages/SsoCallbackPage';
import AdminAppsPage from './pages/AdminAppsPage';
import AdminCategoriesPage from './pages/AdminCategoriesPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminUserNewPage from './pages/AdminUserNewPage';
import AdminAnnouncementsPage from './pages/AdminAnnouncementsPage';
import AdminAccessLogPage from './pages/AdminAccessLogPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import ProfilePage from './pages/ProfilePage';

/**
 * 管理者が1人も居ない状態では、どの画面よりも先に初期セットアップを済ませてもらう。
 */
function RequireSetupComplete({ children }: { children: ReactNode }) {
  const { needsSetup, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (needsSetup) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

/** セットアップ済みなら /setup は開けないようにする */
function SetupRoute() {
  const { needsSetup, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (needsSetup === false) return <Navigate to="/" replace />;
  return <SetupPage />;
}

export default function App() {
  return (
    <ThemeProvider>
    <ToastProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* 初期セットアップ（Layoutなし） */}
          <Route path="/setup" element={<SetupRoute />} />

          {/* ログイン画面（Layoutなし） */}
          <Route path="/login" element={<LoginPage />} />

          {/* SSO コールバック（Layoutなし） */}
          <Route path="/sso/callback" element={<SsoCallbackPage />} />

          {/* Layoutあり */}
          <Route
            path="/"
            element={
              <RequireSetupComplete>
                <Layout />
              </RequireSetupComplete>
            }
          >
            {/* HUBトップは誰でもアクセス可 */}
            <Route index element={<HubPage />} />

            {/* プロフィール（ログイン済みユーザーのみ） */}
            <Route
              path="profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />

            {/* パスワード変更（ログイン済みユーザーのみ） */}
            <Route
              path="change-password"
              element={
                <ProtectedRoute>
                  <ChangePasswordPage />
                </ProtectedRoute>
              }
            />

            {/* 管理画面（管理者のみ） */}
            <Route path="admin" element={<Navigate to="/admin/apps" replace />} />
            <Route
              path="admin/apps"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminAppsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/categories"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminCategoriesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/users"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminUsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/users/new"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminUserNewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/announcements"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminAnnouncementsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/access-log"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminAccessLogPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ToastProvider>
    </ThemeProvider>
  );
}
