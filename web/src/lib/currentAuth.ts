import { onAuthStateChanged, type Auth, type User } from "firebase/auth";
import type { AuthClaims } from "./authz";

type CurrentAuthState = {
  user: User | null;
  claims: AuthClaims;
  loading: boolean;
  error: string | null;
};

// Token refreshes may settle after another account notification or unmount.
// Publish claims only for the still-current notification and clear prior roles
// before starting every refresh. Backend authorization remains authoritative.
export function observeCurrentAuth(auth: Auth, publish: (state: CurrentAuthState) => void) {
  let active = true;
  let sequence = 0;
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (!active) return;
    const currentSequence = ++sequence;
    publish({ user, claims: null, loading: user !== null, error: null });
    if (!user) return;

    void (async () => {
      try {
        const token = await user.getIdTokenResult(true);
        if (active && sequence === currentSequence) {
          publish({ user, claims: token.claims, loading: false, error: null });
        }
      } catch {
        if (active && sequence === currentSequence) {
          publish({ user, claims: null, loading: false, error: "Unable to verify access. Sign in again to retry." });
        }
      }
    })();
  });

  return () => {
    active = false;
    ++sequence;
    unsubscribe();
  };
}
