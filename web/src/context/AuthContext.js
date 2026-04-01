"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthProvider = AuthProvider;
exports.useAuth = useAuth;
var react_1 = require("react");
var auth_1 = require("firebase/auth");
var firebase_1 = require("../firebase");
var AuthContext = (0, react_1.createContext)(undefined);
function AuthProvider(_a) {
    var children = _a.children;
    var _b = (0, react_1.useState)(null), user = _b[0], setUser = _b[1];
    var _c = (0, react_1.useState)(true), loading = _c[0], setLoading = _c[1];
    (0, react_1.useEffect)(function () {
        var unsub = (0, auth_1.onAuthStateChanged)(firebase_1.auth, function (nextUser) {
            setUser(nextUser);
            setLoading(false);
        });
        return unsub;
    }, []);
    var value = (0, react_1.useMemo)(function () { return ({
        user: user,
        loading: loading,
        logout: function () { return (0, auth_1.signOut)(firebase_1.auth); },
    }); }, [user, loading]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
function useAuth() {
    var ctx = (0, react_1.useContext)(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return ctx;
}
