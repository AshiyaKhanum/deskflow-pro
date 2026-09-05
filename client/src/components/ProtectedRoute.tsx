import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';
import { LoadingState } from './ui/States';

interface ProtectedRouteProps {
  children: JSX.Element;
  allowedRoles?: Role[];
}

/**
 * Frontend route guard - this is a UX convenience ONLY (hides pages a role
 * shouldn't see / redirects them away). It is NOT the security boundary: every
 * API call these pages make is independently re-checked by the backend's
 * authenticate()/authorize() middleware, which is what actually enforces RBAC.
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingState label="Checking your session…" />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  return children;
}
