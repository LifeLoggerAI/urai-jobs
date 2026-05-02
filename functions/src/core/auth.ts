import type { CallableRequest } from 'firebase-functions/v2/https';
import { onCall } from 'firebase-functions/v2/https';
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
 * This uses the Firebase Functions v2 callable request shape while preserving
 * a small context-compatible object for older handlers.
 */
export const withAuthenticatedRole =
  <T>(allowedRoles: Array<User['role']>, handler: (data: T, context: any, user: User) => any) =>
  onCall({ region: 'us-central1' }, async (request: CallableRequest<T>) => {
    if (!request.auth) {
      throw httpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const user = await getAuthenticatedUser(request.auth.uid);

    const hasPermission = allowedRoles.some((role) => user.role === role);

    if (!hasPermission) {
      throw httpsError('permission-denied', 'You do not have permission to perform this action.');
    }

    const context = {
      auth: request.auth,
      rawRequest: request.rawRequest
    };

    return handler(request.data as T, context, user);
  });
