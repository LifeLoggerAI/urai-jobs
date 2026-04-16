import { jsx as _jsx } from "react/jsx-runtime";
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
export function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading)
        return _jsx("div", { children: "Loading..." });
    return user ? children : _jsx(Navigate, { to: "/login", replace: true });
}
