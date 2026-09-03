import * as functions from 'firebase-functions';
export function getAuthContext(uid) {
    return { uid: uid || 'dev-user' };
}
export function ensureHasPermission(_ctx, _perm) {
    return true;
}
export function withAuthenticatedRole(allowedRoles, handler) {
    return functions.https.onCall(async (data, context) => {
        void allowedRoles;
        return handler(data, context);
    });
}
