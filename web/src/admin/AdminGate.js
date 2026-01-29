"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var useAdminAuth = function () {
    console.warn("AdminGate: Using placeholder auth logic. Access is currently denied to all.");
    return { isAdmin: false, loading: false };
};
var AdminGate = function (_a) {
    var children = _a.children;
    var _b = useAdminAuth(), isAdmin = _b.isAdmin, loading = _b.loading;
    if (loading) {
        return <div>Loading...</div>;
    }
    if (!isAdmin) {
        return (<div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Access Restricted</h1>
        <p>You do not have permission to view this page.</p>
      </div>);
    }
    return <>{children}</>;
};
exports.default = AdminGate;
