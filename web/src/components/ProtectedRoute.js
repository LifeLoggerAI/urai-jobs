import { jsx as _jsx } from "react/jsx-runtime";
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export function ProtectedRoute({ children, allowedRoles }) {
    const { user, role, loading, error } = useAuth();
    if (loading) {
        return _jsx("div", { children: "Loading..." }); // Or a spinner component
    }
    if (error) {
        return _jsx("div", { children: "Error loading authentication status." }); // Or a more user-friendly error page
    }
    if (!user) {
        // Not authenticated, redirect to login
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    if (!role || !allowedRoles.includes(role)) {
        // Authenticated but not authorized, redirect to a "not authorized" page
        // You should create this page
        return _jsx(Navigate, { to: "/unauthorized", replace: true });
    }
    // Authenticated and authorized, render the children
    return children;
}
