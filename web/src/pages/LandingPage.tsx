const features = [
  {
    title: "Queue supported work honestly",
    body: "Submit allowlisted job types into one traceable execution layer. Worker families without proof remain gated."
  },
  {
    title: "Operate with guardrails",
    body: "Monitor status, failures, retries, cancellations, logs, payloads, and outputs from the backend-protected admin console."
  },
  {
    title: "Built for URAI systems",
    body: "Designed around subsystem ownership, RBAC, Firebase Functions, Firestore queues, workers, and auditability."
  },
  {
    title: "Recover from failures",
    body: "Retry failed work, cancel active work, inspect errors, and preserve a log trail for each job."
  },
  {
    title: "Cloud-native preview runtime",
    body: "Uses Firebase, Cloud Functions, Pub/Sub, Scheduler, and Node.js 22. Production lifecycle proof still requires an operator-gated smoke run."
  },
  {
    title: "Ready to extend safely",
    body: "New job types must be allowlisted, schema-validated, worker-authenticated, and lifecycle-smoked before being described as live."
  }
];

const careerSurfaces = [
  {
    version: "V1",
    title: "Career Mirror",
    href: "/career-mirror",
    body: "Visible product shell for editable work preferences and fit workflows. Runtime worker execution is gated until proof exists."
  },
  {
    version: "V2",
    title: "Marketplace",
    href: "/career-marketplace",
    body: "Candidate, employer, opportunity, document intake, and packet surfaces. Marketplace labor claims are preview-only until backed by real jobs."
  },
  {
    version: "V3",
    title: "Automation Controls",
    href: "/career-automation",
    body: "Rule controls, global pause, per-rule pause, and review ledger UI. Autonomous execution is not fully production verified."
  },
  {
    version: "V4",
    title: "Decision Layer",
    href: "/career-decision",
    body: "Interview prep, offer comparison, burnout-risk framing, and spatial portal surfaces with worker execution gated."
  },
  {
    version: "V5",
    title: "Passport",
    href: "/career-passport",
    body: "User-controlled profile packet and Passport export surface. Export worker execution requires proof before production claims."
  }
];

export function LandingPage() {
  return (
    <div className="landing-page">
      <main className="page-shell">
        <section className="hero hero-grid">
          <div>
            <div className="eyebrow">URAI Jobs</div>
            <h1>Worker infrastructure preview for the URAI ecosystem.</h1>
            <p>
              URAI Jobs implements Firebase job creation, queue storage, leasing, dispatcher functions,
              and operator visibility. Production lifecycle proof still requires an operator-gated smoke run,
              and some worker families remain gated until real execution replaces scaffolded handlers.
            </p>

            <div className="hero-actions">
              <a href="/career-mirror" className="cta-button">Open Career Mirror</a>
              <a href="/career-versions" className="secondary-button">View versions</a>
              <a href="/create" className="secondary-button">Create a job</a>
              <a href="/admin" className="secondary-button">Open admin</a>
            </div>
          </div>

          <aside className="hero-card">
            <div className="eyebrow">Implemented capabilities</div>
            <ul className="check-list">
              <li>Firebase-backed job creation for allowlisted job types</li>
              <li>Backend-protected operator admin dashboard</li>
              <li>Firestore queue, lease, status, result, and log documents</li>
              <li>Pub/Sub dispatcher with duplicate terminal no-op guard</li>
              <li>Inline fallback disabled by default in production</li>
              <li>Unimplemented worker families blocked from false success</li>
            </ul>
          </aside>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div className="eyebrow">Career product surfaces</div>
            <h2>V1 through V5 are visible as gated product previews.</h2>
            <p>
              The route surfaces are present, but autonomous execution claims are intentionally withheld
              until each worker path has real implementation, auth, logs, results, and production lifecycle proof.
            </p>
          </div>

          <div className="features-grid">
            {careerSurfaces.map((surface) => (
              <article className="feature-item" key={surface.version}>
                <div className="eyebrow">{surface.version}</div>
                <h3>{surface.title}</h3>
                <p>{surface.body}</p>
                <div className="hero-actions compact">
                  <a href={surface.href} className="secondary-button">Open {surface.version}</a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div className="eyebrow">Why it exists</div>
            <h2>One observable backbone for background work.</h2>
            <p>
              URAI products need background work that is observable, permissioned,
              resilient, and easy to reason about under production pressure.
            </p>
          </div>

          <div className="features-grid">
            {features.map((feature) => (
              <article className="feature-item" key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="call-to-action">
          <div>
            <div className="eyebrow">Operator guarded</div>
            <h2>Submit a controlled job or inspect queue state.</h2>
            <p>Use the create page for allowlisted job submission and the admin page for backend-protected queue visibility.</p>
          </div>
          <div className="hero-actions">
            <a href="/create" className="cta-button">Create job</a>
            <a href="/admin" className="secondary-button">View admin</a>
          </div>
        </section>
      </main>
    </div>
  );
}
