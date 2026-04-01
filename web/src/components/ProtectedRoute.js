"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ProtectedRoute;
var react_router_dom_1 = require("react-router-dom");
var AuthContext_1 = require("../context/AuthContext");
function ProtectedRoute(_a) {
    var children = _a.children;
    var _b = (0, AuthContext_1.useAuth)(), user = _b.user, loading = _b.loading;
    var location = (0, react_router_dom_1.useLocation)();
    if (loading) {
        return <div>Loading...</div>;
    }
    if (!user) {
        return <react_router_dom_1.Navigate to="/login" replace state={{ from: location.pathname }}/>;
    }
    return <>{children}</>;
}
