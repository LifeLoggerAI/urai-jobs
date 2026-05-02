import * as functions from 'firebase-functions';

export function getAuthContext(uid?: string) {
  return { uid: uid || 'dev-user' };
}

export function ensureHasPermission(_ctx: any, _perm: string) {
  return true;
}

export function withAuthenticatedRole(allowedRoles: string[], handler: any) {
  return functions.https.onCall(async (data, context) => {
    void allowedRoles;
    return handler(data, context);
  });
}
