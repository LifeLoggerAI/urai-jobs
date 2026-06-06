const features = [
  {
    title: "Queue every production workflow",
    body: "Submit rendering, narration, spatial, asset, analytics, and orchestration jobs into one traceable execution layer."
  },
  {
    title: "Operate with confidence",
    body: "Monitor status, attempts, failures, retries, cancellations, logs, payloads, and outputs from the admin console."
  },
  {
    title: "Built for URAI systems",
    body: "Designed around subsystem ownership, RBAC, Firebase Functions, Firestore queues, workers, and production auditability."
  },
  {
    title: "Recover from failures",
    body: "Retry failed work, cancel active work, inspect errors, and preserve a complete log trail for each job."
  },
  {
    title: "Cloud-native runtime",
    body: "Runs on Firebase, Cloud Functions, Pub/Sub, Scheduler, and Node.js 22 with deployment gates protecting production."
  },
  {
    title: "Ready to extend",
    body: "Add new job types and workers without rebuilding every product surface that depends on background execution."
  }
];

const careerSurfaces = [
  {
    version: "V1",
    title: "Career Mirror",
    href: "/career-mirror",
    body: "Editable work preferences, saved opportunities, hidden opportunities, explainable fit, and profile/fit runtime jobs."
  },
  {
    version: "V2",
    title: "Marketplace",
    href: "/career-marketplace",
    body: "Candidate profile, employer profile, opportunity detail, document intake, and review packet runtime jobs."
  },
  {
    version: "V3",
    title: "Automation Controls",
    href: "/career-automation",
    body: "Rule controls, global pause, per-rule pause, review ledger, and follow-up planning runtime jobs."
  },
  {
    version: "V4",
    title: "Decision Layer",
    href: "/career-decision",
    body: "Interview prep, offer comparison, burnout-risk framing, and spatial career portal runtime jobs."
  },
  {
    version: "V5",
    title: "Passport",
    href: "/career-passport",
    body: "User-controlled profile packets, economic path graph, skill gaps, modes, and Passport export runtime job."
  }
];

export function LandingPage() {
  return (
    <div className="landing-page">
      <main className="page-shell">
        <section className="hero hero-grid">
          <div>
            <div className="eyebrow">URAI Jobs</div>
            <h1>The production job layer and career runtime for the URAI ecosystem.</h1>
            <p>
              URAI Jobs gives operators and internal systems one reliable place to create,
              monitor, retry, cancel, and audit complex background work while powering the
              V1 through V5 autonomous career product surfaces.
            </p>

            <div className="hero-actions">
              <a href="/career-mirror" className="cta-button">Open Career Mirror</a>
              <a href="/career-versions" className="secondary-button">View versions</a>
              <a href="/create" className="secondary-button">Create a job</a>
              <a href="/admin" className="secondary-button">Open admin</a>
            </div>
          </div>

          <aside className="hero-card">
            <div className="eyebrow">Live capabilities</div>
            <ul className="check-list">
              <li>Firebase-backed job creation</li>
              <li>Operator admin dashboard</li>
              <li>Career worker job contracts</li>
              <li>Career Mirror through Passport surfaces</li>
              <li>Payload, output, and log inspection</li>
              <li>Node.js 22 functions runtime</li>
            </ul>
          </aside>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div className="eyebrow">Career product surfaces</div>
            <h2>V1 through V5 are now visible from the product shell.</h2>
            <p>
              Each surface is connected to approved career runtime jobs while keeping review controls,
              user-owned state, and the runtime/product boundary clear.
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
            <h2>One backbone for work that cannot disappear.</h2>
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
            <div className="eyebrow">Operator ready</div>
            <h2>Submit a smoke job or inspect live queue state.</h2>
            <p>Use the create page for controlled job submission and the admin page for queue visibility.</p>
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
