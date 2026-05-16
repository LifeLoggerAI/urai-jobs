import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from "react";
import { LoginPage } from "./pages/LoginPage";
import { LandingPage } from "./pages/LandingPage";
import { CreateJobPage } from "./pages/CreateJobPage";
import { AdminPage } from "./pages/AdminPage";
import { PrivacyPage, TermsPage, TrustSafetyPage } from "./pages/LegalPages";
import { trackJobsEvent } from "./lib/analytics";
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
    trackJobsEvent("page_viewed", { path: pathname || "/", surface: "web" });
    if (pathname.startsWith("/login"))
        return _jsx(LoginPage, {});
    if (pathname.startsWith("/admin"))
        return _jsx(AdminPage, {});
    if (pathname.startsWith("/create"))
        return _jsx(CreateJobPage, {});
    if (pathname.startsWith("/privacy"))
        return _jsx(PrivacyPage, {});
    if (pathname.startsWith("/terms"))
        return _jsx(TermsPage, {});
    if (pathname.startsWith("/trust"))
        return _jsx(TrustSafetyPage, {});
    return _jsx(LandingPage, {});
}
export default function App() {
    return (_jsx(AppErrorBoundary, { children: _jsxs("div", { className: "app", children: [_jsxs("nav", { className: "top-nav", children: [_jsx("a", { className: "brand", href: "/", children: "URAI Jobs" }), _jsxs("div", { children: [_jsx("a", { href: "/login", children: "Login" }), _jsx("a", { href: "/create", children: "Create" }), _jsx("a", { href: "/admin", children: "Admin" }), _jsx("a", { href: "/privacy", children: "Privacy" }), _jsx("a", { href: "/terms", children: "Terms" }), _jsx("a", { href: "/trust", children: "Trust" })] })] }), routeForPath(window.location.pathname)] }) }));
}
