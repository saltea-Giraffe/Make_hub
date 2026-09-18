import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import HubPage from './pages/HubPage';
import LoginPage from './pages/LoginPage';
import AdminAppsPage from './pages/AdminAppsPage';
import AdminCategoriesPage from './pages/AdminCategoriesPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminUserNewPage from './pages/AdminUserNewPage';
import AdminAnnouncementsPage from './pages/AdminAnnouncementsPage';
import AdminAccessLogPage from './pages/AdminAccessLogPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  return (
    <ThemeProvider>
    <ToastProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ログイン画面（Layoutなし） */}
          <Route path="/login" element={<LoginPage />} />

          {/* Layoutあり */}
          <Route path="/" element={<Layout />}>
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
