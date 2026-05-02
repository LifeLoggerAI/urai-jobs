import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from "react";
import { LoginPage } from "./pages/LoginPage";
import { LandingPage } from "./pages/LandingPage";
import { CreateJobPage } from "./pages/CreateJobPage";
import { AdminPage } from "./pages/AdminPage";
class AppErrorBoundary extends Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
        return { error };
    }
    render() {
        if (this.state.error) {
            return (_jsx("main", { className: "page-shell", children: _jsxs("section", { className: "panel danger", children: [_jsx("div", { className: "eyebrow", children: "Runtime Error" }), _jsx("h1", { children: "URAI Jobs UI failed to render." }), _jsx("pre", { children: this.state.error.message })] }) }));
        }
        return this.props.children;
    }
}
function routeForPath(pathname) {
    if (pathname.startsWith("/login"))
        return _jsx(LoginPage, {});
    if (pathname.startsWith("/admin"))
        return _jsx(AdminPage, {});
    if (pathname.startsWith("/create"))
        return _jsx(CreateJobPage, {});
    return _jsx(LandingPage, {});
}
export default function App() {
    return (_jsx(AppErrorBoundary, { children: _jsxs("div", { className: "app", children: [_jsxs("nav", { className: "top-nav", children: [_jsx("a", { className: "brand", href: "/", children: "URAI Jobs" }), _jsxs("div", { children: [_jsx("a", { href: "/login", children: "Login" }), _jsx("a", { href: "/create", children: "Create" }), _jsx("a", { href: "/admin", children: "Admin" })] })] }), routeForPath(window.location.pathname)] }) }));
}
