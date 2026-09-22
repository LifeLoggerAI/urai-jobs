const lifecycle = [
  { title: "PENDING", body: "Authorized work has been accepted and is waiting for a lease." },
  { title: "LEASED", body: "A worker lease has been issued and is bounded by runtime authority." },
  { title: "RUNNING", body: "The configured worker is executing the job." },
  { title: "SUCCESS", body: "The job completed with a persisted result or artifact." },
  { title: "FAILED / DEAD", body: "Failure remains explicit; retry or dead-letter state is inspectable." },
  { title: "CANCELLED", body: "Execution was stopped and remains visible in the record." }
];

const operatorQuestions = [
  "What work is running right now?",
  "Which worker owns it?",
  "What dependencies and permissions apply?",
  "What attempts have occurred?",
  "What artifact or result was produced?",
  "If it failed, why and what is safe to do next?"
];

export function LandingPage() {
  return (
    <div className="landing-page">
      <main className="page-shell">
        <section className="hero hero-grid" aria-labelledby="jobs-title">
          <div>
            <div className="eyebrow">Internal execution fabric</div>
            <h1 id="jobs-title">See what URAI is doing, why it is doing it, and what happened.</h1>
            <p>
              URAI Jobs is the internal asynchronous runtime for controlled work across URAI systems. It exposes queue state, worker execution, retries, cancellation, artifacts, failures, and receipts to authorized operators without presenting simulated activity as live production.
            </p>
            <div className="hero-actions">
              <a href="/login" className="cta-button">Operator sign in</a>
              <a href="/trust" className="secondary-button">Runtime boundaries</a>
            </div>
          </div>

          <aside className="hero-card" aria-label="Operator questions">
            <div className="eyebrow">Operator view</div>
            <ul className="check-list">
              {operatorQuestions.map((question) => <li key={question}>{question}</li>)}
            </ul>
          </aside>
        </section>

        <section className="section-block" aria-labelledby="lifecycle-title">
          <div className="section-heading">
            <div className="eyebrow">Canonical lifecycle</div>
            <h2 id="lifecycle-title">Request → queue → execute → result → receipt.</h2>
            <p>
              Runtime state is explicit. Jobs do not become successful because a request was accepted, and fallback or simulated output does not count as worker proof.
            </p>
          </div>
          <div className="features-grid">
            {lifecycle.map((state) => (
              <article className="feature-item" key={state.title}>
                <h3>{state.title}</h3>
                <p>{state.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block" aria-labelledby="boundaries-title">
          <div className="section-heading">
            <div className="eyebrow">Runtime boundaries</div>
            <h2 id="boundaries-title">Internal infrastructure, not a public careers marketplace.</h2>
            <p>
              Public career-facing concepts are not canonical URAI Jobs product surfaces. This runtime remains focused on governed execution for Spatial, Studio, Asset Factory, Analytics, Communications, Privacy, Storytime, Admin, and related URAI systems.
            </p>
          </div>
        </section>

        <section className="call-to-action" aria-labelledby="operator-cta-title">
          <div>
            <div className="eyebrow">Authorized operation</div>
            <h2 id="operator-cta-title">Observe first. Act only with authority. Preserve the evidence.</h2>
            <p>
              Job creation and operator actions remain permission-gated. Retry, cancellation, and reconciliation should leave the job history understandable after the action completes.
            </p>
          </div>
          <div className="hero-actions">
            <a href="/login" className="cta-button">Sign in</a>
            <a href="/privacy" className="secondary-button">Privacy</a>
            <a href="/trust" className="secondary-button">Trust &amp; Safety</a>
          </div>
        </section>
      </main>
    </div>
  );
}
