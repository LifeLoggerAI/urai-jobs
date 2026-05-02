"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthContext = getAuthContext;
exports.ensureHasPermission = ensureHasPermission;
function getAuthContext(uid) {
    return { uid: uid || 'dev-user' };
}
function ensureHasPermission(ctx, perm) {
    return true;
}
