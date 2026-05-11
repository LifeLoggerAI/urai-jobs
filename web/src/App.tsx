import { Component, type ReactNode } from "react";
import { LoginPage } from "./pages/LoginPage";
import { LandingPage } from "./pages/LandingPage";
import { CreateJobPage } from "./pages/CreateJobPage";
import { AdminPage } from "./pages/AdminPage";
import { PrivacyPage, TermsPage, TrustSafetyPage } from "./pages/LegalPages";
import {
  ApplyPage,
  CandidateProfilePage,
  EmployersPage,
  JobDetailPage,
  JobsPage,
  PricingPage
} from "./pages/MarketplacePages";
import { trackJobsEvent } from "./lib/analytics";

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

function routeForPath(pathname: string) {
  trackJobsEvent("page_viewed", { path: pathname || "/", surface: "web" });

  if (pathname.startsWith("/login")) return <LoginPage />;
  if (pathname.startsWith("/admin")) return <AdminPage />;
  if (pathname.startsWith("/create")) return <CreateJobPage />;
  if (pathname === "/jobs" || pathname === "/jobs/") return <JobsPage />;
  if (pathname.startsWith("/jobs/")) return <JobDetailPage jobId={decodeURIComponent(pathname.replace(/^\/jobs\//, ""))} />;
  if (pathname.startsWith("/apply/")) return <ApplyPage jobId={decodeURIComponent(pathname.replace(/^\/apply\//, ""))} />;
  if (pathname.startsWith("/candidate")) return <CandidateProfilePage />;
  if (pathname.startsWith("/employers")) return <EmployersPage />;
  if (pathname.startsWith("/pricing")) return <PricingPage />;
  if (pathname.startsWith("/privacy")) return <PrivacyPage />;
  if (pathname.startsWith("/terms")) return <TermsPage />;
  if (pathname.startsWith("/trust")) return <TrustSafetyPage />;
  return <LandingPage />;
}

export default function App() {
  return (
    <AppErrorBoundary>
      <div className="app">
        <nav className="top-nav">
          <a className="brand" href="/">URAI Jobs</a>
          <div>
            <a href="/jobs">Jobs</a>
            <a href="/candidate">Candidate</a>
            <a href="/employers">Employers</a>
            <a href="/pricing">Pricing</a>
            <a href="/login">Login</a>
            <a href="/create">Create</a>
            <a href="/admin">Admin</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/trust">Trust</a>
          </div>
        </nav>
        {routeForPath(window.location.pathname)}
      </div>
    </AppErrorBoundary>
  );
}
