import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { TicketListPage } from '../pages/TicketListPage';
import { TicketDetailPage } from '../pages/TicketDetailPage';
import { NewTicketPage } from '../pages/NewTicketPage';
import { DashboardPage } from '../pages/DashboardPage';
import { AdminUsersPage } from '../pages/AdminUsersPage';
import { AdminSlaPage } from '../pages/AdminSlaPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ForbiddenPage } from '../pages/ForbiddenPage';
import { useAuth } from '../context/AuthContext';

export function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isLoading || !isAuthenticated ? <LoginPage /> : <Navigate to="/tickets" replace />} />
      <Route
        path="/register"
        element={isLoading || !isAuthenticated ? <RegisterPage /> : <Navigate to="/tickets" replace />}
      />
      <Route path="/403" element={<ForbiddenPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/tickets" replace />} />
        <Route path="/tickets" element={<TicketListPage />} />
        <Route
          path="/tickets/new"
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <NewTicketPage />
            </ProtectedRoute>
          }
        />
        <Route path="/tickets/:id" element={<TicketDetailPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/sla"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminSlaPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
