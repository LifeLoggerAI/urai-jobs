import { getFirestore } from 'firebase-admin/firestore';
import { https } from 'firebase-functions';
import type { CallableContext } from 'firebase-functions/v1/https';
import { User } from '@urai-jobs/shared-types';
import { httpsError } from './errors.js';
import { userDoc } from './firestore-paths.js';

/**
 * Fetches the user document from Firestore and returns it.
 * Throws an error if the user is not found.
 */
export async function getAuthenticatedUser(uid: string): Promise<User> {
  const userRef = userDoc(uid);
  const userSnapshot = await userRef.get();

  if (!userSnapshot.exists) {
    throw httpsError('unauthenticated', 'User not found. This may happen if the user was recently deleted.');
  }

  return userSnapshot.data() as User;
}

/**
 * A Higher-Order Function that wraps a callable function to enforce role-based access control.
 *
 * @param allowedRoles An array of roles that are allowed to call this function.
 * @param handler The function to execute if the user has one of the allowed roles.
 * @returns A callable function that enforces RBAC.
 */
export const withAuthenticatedRole = 
  <T>(allowedRoles: Array<User['role']>, handler: (data: T, context: CallableContext, user: User) => any) => 
  https.onCall(async (data: T, context: CallableContext) => {
    if (!context.auth) {
      throw httpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const user = await getAuthenticatedUser(context.auth.uid);

    const hasPermission = allowedRoles.some((role) => user.role === role);

    if (!hasPermission) {
      throw httpsError('permission-denied', 'You do not have permission to perform this action.');
    }

    return handler(data, context, user);
  });
