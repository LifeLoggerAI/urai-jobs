import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { CreateJobPage } from './pages/CreateJobPage';
export default function App() {
    return (_jsx(AuthProvider, { children: _jsxs(BrowserRouter, { children: [_jsxs("nav", { children: [_jsx(Link, { to: "/", children: "Jobs" }), " | ", _jsx(Link, { to: "/login", children: "Login" }), " | ", _jsx(Link, { to: "/signup", children: "Sign up" })] }), _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "/signup", element: _jsx(SignupPage, {}) }), _jsx(Route, { path: "/", element: _jsx(ProtectedRoute, { children: _jsx(CreateJobPage, {}) }) })] })] }) }));
}
