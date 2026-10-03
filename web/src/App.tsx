import { Component, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { LoginPage } from "./pages/LoginPage";
import { LandingPage } from "./pages/LandingPage";
import { CreateJobPage } from "./pages/CreateJobPage";
import { AdminPage } from "./pages/AdminPage";
import { PrivacyPage, TermsPage, TrustSafetyPage } from "./pages/LegalPages";
import { trackJobsEvent } from "./lib/analytics";
import { auth } from "./lib/firebase";
import { authStatusLabel, hasJobCreateAccess, hasOperatorAccess, type AuthClaims } from "./lib/authz";

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="page-shell">
          <section className="panel danger">
            <div className="eyebrow">Runtime error</div>
            <h1>URAI Jobs UI failed to render.</h1>
            <pre>{this.state.error.message}</pre>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

function AccessDeniedPage({ required }: { required: string }) {
  return (
    <main className="page-shell">
      <section className="panel danger">
        <div className="eyebrow">Permission required</div>
        <h1>URAI Jobs is an internal operator runtime.</h1>
        <p>{required}</p>
        <p>Sign in with an authorized account. Backend callable functions remain the source of truth for authorization.</p>
        <a className="secondary-button" href="/login">Go to login</a>
      </section>
    </main>
  );
}

function LegacyCareerSurface() {
  return (
    <main className="page-shell">
      <section className="panel">
        <div className="eyebrow">Superseded surface</div>
        <h1>This career-facing route is not part of the canonical URAI Jobs runtime.</h1>
        <p>
          URAI Jobs is internal execution infrastructure. Career-facing product concepts are not exposed from this runtime unless a future product decision explicitly re-authorizes them.
        </p>
        <a className="secondary-button" href="/">Return to runtime overview</a>
      </section>
    </main>
  );
}

function routeForPath(pathname: string, user: User | null, claims: AuthClaims, authLoading: boolean) {
  trackJobsEvent("page_viewed", { path: pathname || "/", surface: "web", authStatus: authStatusLabel(user, claims) });

  if (pathname.startsWith("/login")) return <LoginPage />;
  if (pathname.startsWith("/admin")) {
    if (authLoading) return <main className="page-shell"><section className="panel"><p>Checking operator access...</p></section></main>;
    if (!hasOperatorAccess(claims)) return <AccessDeniedPage required="Admin dashboard access requires an admin/operator claim." />;
    return <AdminPage />;
  }
  if (pathname.startsWith("/create")) {
    if (authLoading) return <main className="page-shell"><section className="panel"><p>Checking job-create access...</p></section></main>;
    if (!hasJobCreateAccess(user, claims)) return <AccessDeniedPage required="Job creation requires admin/operator or explicit job-create permission." />;
    return <CreateJobPage />;
  }

  if (
    pathname.startsWith("/career-passport") ||
    pathname.startsWith("/career-decision") ||
    pathname.startsWith("/career-automation") ||
    pathname.startsWith("/career-marketplace") ||
    pathname.startsWith("/career-versions") ||
    pathname.startsWith("/career-mirror")
  ) {
    return <LegacyCareerSurface />;
  }

  if (pathname.startsWith("/privacy")) return <PrivacyPage />;
  if (pathname.startsWith("/terms")) return <TermsPage />;
  if (pathname.startsWith("/trust")) return <TrustSafetyPage />;
  return <LandingPage />;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<AuthClaims>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        const token = await nextUser.getIdTokenResult(true);
        setClaims(token.claims);
      } else {
        setClaims(null);
      }
      setAuthLoading(false);
    });
  }, []);

  const canOperate = hasOperatorAccess(claims);
  const canCreate = hasJobCreateAccess(user, claims);

  return (
    <AppErrorBoundary>
      <div className="app">
        <nav className="top-nav" aria-label="URAI Jobs navigation">
          <a className="brand" href="/">URAI Jobs</a>
          <div>
            <a href="/">Runtime</a>
            <a href="/login">Login</a>
            {canCreate && <a href="/create">Create job</a>}
            {canOperate && <a href="/admin">Operator console</a>}
            <a href="/privacy">Privacy</a>
            <a href="/trust">Trust</a>
            <a href="/terms">Terms</a>
          </div>
        </nav>
        {routeForPath(window.location.pathname, user, claims, authLoading)}
      </div>
    </AppErrorBoundary>
  );
}
