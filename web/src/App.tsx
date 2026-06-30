import { Component, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { LoginPage } from "./pages/LoginPage";
import { LandingPage } from "./pages/LandingPage";
import { CreateJobPage } from "./pages/CreateJobPage";
import { AdminPage } from "./pages/AdminPage";
import { CareerMirrorPage } from "./pages/CareerMirrorPage";
import { CareerVersionConsolePage } from "./pages/CareerVersionConsolePage";
import { CareerMarketplacePage } from "./pages/CareerMarketplacePage";
import { CareerAutomationPage } from "./pages/CareerAutomationPage";
import { CareerDecisionPage } from "./pages/CareerDecisionPage";
import { CareerPassportPage } from "./pages/CareerPassportPage";
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
            <div className="eyebrow">Runtime Error</div>
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
        <div className="eyebrow">Access denied</div>
        <h1>URAI Jobs is an internal operator runtime.</h1>
        <p>{required}</p>
        <p>Sign in with an authorized account. Backend callable functions remain the source of truth for authorization.</p>
        <a className="secondary-button" href="/login">Go to login</a>
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
  if (pathname.startsWith("/career-passport")) return <CareerPassportPage />;
  if (pathname.startsWith("/career-decision")) return <CareerDecisionPage />;
  if (pathname.startsWith("/career-automation")) return <CareerAutomationPage />;
  if (pathname.startsWith("/career-marketplace")) return <CareerMarketplacePage />;
  if (pathname.startsWith("/career-versions")) return <CareerVersionConsolePage />;
  if (pathname.startsWith("/career-mirror")) return <CareerMirrorPage />;
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
        <nav className="top-nav">
          <a className="brand" href="/">URAI Jobs</a>
          <div>
            <a href="/career-mirror">Career Mirror</a>
            <a href="/career-marketplace">Marketplace V2</a>
            <a href="/career-automation">Automation V3</a>
            <a href="/career-decision">Decision V4</a>
            <a href="/career-passport">Passport V5</a>
            <a href="/career-versions">Version Console</a>
            <a href="/login">Login</a>
            {canCreate && <a href="/create">Create</a>}
            {canOperate && <a href="/admin">Admin</a>}
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/trust">Trust</a>
          </div>
        </nav>
        {routeForPath(window.location.pathname, user, claims, authLoading)}
      </div>
    </AppErrorBoundary>
  );
}
