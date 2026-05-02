import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: JSX.Element;
  allowedRoles: Array<'admin' | 'user'>;
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading, error } = useAuth();

  if (loading) {
    return <div>Loading...</div>; // Or a spinner component
  }

  if (error) {
    return <div>Error loading authentication status.</div>; // Or a more user-friendly error page
  }

  if (!user) {
    // Not authenticated, redirect to login
    return <Navigate to="/login" replace />;
  }

  if (!role || !allowedRoles.includes(role)) {
    // Authenticated but not authorized, redirect to a "not authorized" page
    // You should create this page
    return <Navigate to="/unauthorized" replace />;
  }

  // Authenticated and authorized, render the children
  return children;
}
