import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Permission } from '../types';
export function RequireAuth({ permission }: { permission?: Permission }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading) return <p role="status">Checking your session…</p>;
  if (auth.error)
    return (
      <div role="alert">
        <p>{auth.error}</p>
        <button onClick={auth.refresh}>Retry authentication</button>
      </div>
    );
  if (!auth.authenticated)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (permission && !auth.permissions.includes(permission))
    return (
      <p role="alert">
        Access denied. Your account does not have permission to view this page.
      </p>
    );
  return <Outlet />;
}
