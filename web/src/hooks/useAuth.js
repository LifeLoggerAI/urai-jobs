"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAuth = useAuth;
var react_1 = require("react");
var AuthContext_1 = require("../context/AuthContext");
function useAuth() {
    var context = (0, react_1.useContext)(AuthContext_1.AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
