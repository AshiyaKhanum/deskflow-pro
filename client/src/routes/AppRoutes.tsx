import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { LoadingState } from '../components/ui/States';
import { useAuth } from '../context/AuthContext';

// Route-level code splitting: each page ships in its own chunk instead of one bundle
// everyone downloads up front. LoginPage/RegisterPage stay eager since they're what an
// unauthenticated visitor needs immediately; everything behind the authenticated shell
// (especially the heavier Dashboard, with its charts and aggregated tables) loads on
// first visit to that route instead of blocking the initial page load for every user.
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
const TicketListPage = lazy(() =>
  import('../pages/TicketListPage').then((m) => ({ default: m.TicketListPage })),
);
const TicketDetailPage = lazy(() =>
  import('../pages/TicketDetailPage').then((m) => ({ default: m.TicketDetailPage })),
);
const NewTicketPage = lazy(() =>
  import('../pages/NewTicketPage').then((m) => ({ default: m.NewTicketPage })),
);
const DashboardPage = lazy(() =>
  import('../pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const AdminUsersPage = lazy(() =>
  import('../pages/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })),
);
const AdminSlaPage = lazy(() =>
  import('../pages/AdminSlaPage').then((m) => ({ default: m.AdminSlaPage })),
);
const NotFoundPage = lazy(() =>
  import('../pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);
const ForbiddenPage = lazy(() =>
  import('../pages/ForbiddenPage').then((m) => ({ default: m.ForbiddenPage })),
);

function RouteFallback() {
  return <LoadingState label="Loading…" />;
}

export function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route
          path="/login"
          element={
            isLoading || !isAuthenticated ? <LoginPage /> : <Navigate to="/tickets" replace />
          }
        />
        <Route
          path="/register"
          element={
            isLoading || !isAuthenticated ? <RegisterPage /> : <Navigate to="/tickets" replace />
          }
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
              <ProtectedRoute allowedRoles={['customer', 'agent']}>
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
    </Suspense>
  );
}
