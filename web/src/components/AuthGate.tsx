import { useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../lib/firebase";

type AuthGateProps = {
  children: ReactNode;
  requireOperator?: boolean;
};

type AuthState = {
  loading: boolean;
  user: User | null;
  claims: Record<string, unknown>;
  error: string;
};

function hasOperatorAccess(claims: Record<string, unknown>): boolean {
  const role = claims.role;
  const roles = Array.isArray(claims.roles) ? claims.roles.map(String) : [];
  return (
    role === "admin" ||
    role === "operator" ||
    claims.uraiJobsAdmin === true ||
    roles.includes("admin") ||
    roles.includes("operator")
  );
}

export function AuthGate({ children, requireOperator = false }: AuthGateProps) {
  const [state, setState] = useState<AuthState>({ loading: true, user: null, claims: {}, error: "" });

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        setState({ loading: false, user: null, claims: {}, error: "" });
        return;
      }

      try {
        const token = await nextUser.getIdTokenResult(true);
        setState({ loading: false, user: nextUser, claims: token.claims, error: "" });
      } catch (error) {
        setState({
          loading: false,
          user: nextUser,
          claims: {},
          error: error instanceof Error ? error.message : "Failed to read authentication claims."
        });
      }
    });
  }, []);

  if (state.loading) {
    return (
      <main className="page-shell">
        <section className="panel">
          <div className="eyebrow">Checking access</div>
          <h1>Loading secure URAI Jobs surface.</h1>
        </section>
      </main>
    );
  }

  if (state.error) {
    return (
      <main className="page-shell">
        <section className="panel danger">
          <div className="eyebrow">Access check failed</div>
          <h1>Unable to verify your URAI Jobs permissions.</h1>
          <p>{state.error}</p>
          <a className="secondary-button" href="/login">Open login</a>
        </section>
      </main>
    );
  }

  if (!state.user) {
    return (
      <main className="page-shell">
        <section className="panel">
          <div className="eyebrow">Sign in required</div>
          <h1>This URAI Jobs surface is locked.</h1>
          <p>Job creation and operator views require Firebase authentication. No live job data is shown publicly.</p>
          <a className="secondary-button" href="/login">Sign in</a>
        </section>
      </main>
    );
  }

  if (requireOperator && !hasOperatorAccess(state.claims)) {
    return (
      <main className="page-shell">
        <section className="panel danger">
          <div className="eyebrow">Operator access required</div>
          <h1>The admin console is backend-protected.</h1>
          <p>Your account is signed in, but it does not have an admin/operator claim. Queue data, payloads, logs, retries, and cancellation controls remain hidden.</p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
