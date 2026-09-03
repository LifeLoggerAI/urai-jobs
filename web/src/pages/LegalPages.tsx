export function PrivacyPage() {
  return (
    <main className="page-shell legal-page">
      <section className="panel">
        <div className="eyebrow">Privacy</div>
        <h1>URAI Jobs Privacy Notice</h1>
        <p>
          URAI Jobs is the background job execution and operations layer for URAI systems. It processes job metadata,
          payload references, operator actions, execution logs, retry and cancel activity, and artifact references so URAI
          teams can safely submit, monitor, audit, and recover long-running production work.
        </p>
        <div className="features-grid legal-grid">
          <article className="feature-item">
            <h3>Data we process</h3>
            <p>
              We may process job identifiers, job type, status, timestamps, owner or actor identifiers, payload metadata,
              output references, failure details, logs, queue metrics, and operator notes. Payloads should store only what
              the job needs and should prefer references to controlled storage locations.
            </p>
          </article>
          <article className="feature-item">
            <h3>How it is used</h3>
            <p>
              Data is used to execute jobs, route work to authorized workers, retry failed work, cancel stale work,
              investigate incidents, preserve audit trails, and improve reliability of URAI production systems.
            </p>
          </article>
          <article className="feature-item">
            <h3>Access model</h3>
            <p>
              Access is role-scoped. Operators and admins may inspect operational state, while product clients should
              access only the job records they are authorized to create or monitor. Admin operations are expected to be
              auditable and limited to trusted URAI personnel.
            </p>
          </article>
          <article className="feature-item">
            <h3>Retention and deletion</h3>
            <p>
              Terminal job data, logs, and artifacts should follow URAI retention policies. Deletion or anonymization
              workflows should be routed through approved privacy operations when jobs contain personal data or user-linked
              references.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}

export function TermsPage() {
  return (
    <main className="page-shell legal-page">
      <section className="panel">
        <div className="eyebrow">Terms</div>
        <h1>URAI Jobs Terms of Use</h1>
        <p>
          URAI Jobs is an internal and controlled operations platform for submitting, managing, and auditing background
          work across the URAI ecosystem. Use of this system requires authorization and compliance with URAI security,
          privacy, and production-change procedures.
        </p>
        <div className="features-grid legal-grid">
          <article className="feature-item">
            <h3>Authorized use</h3>
            <p>
              Users may submit and manage jobs only for legitimate URAI operational, product, testing, or support purposes.
              Submissions should follow approved job contracts, ownership rules, and review expectations.
            </p>
          </article>
          <article className="feature-item">
            <h3>No guarantee of execution</h3>
            <p>
              Jobs may be delayed, retried, cancelled, rejected, paused, or dead-lettered for reliability, safety, quota,
              privacy, billing, or incident response reasons. Successful queue submission does not guarantee downstream
              worker completion.
            </p>
          </article>
          <article className="feature-item">
            <h3>Operator responsibility</h3>
            <p>
              Operators are responsible for validating payloads, confirming job type contracts, reviewing outputs, and
              using least-privilege access when working with logs, artifacts, and user-linked data.
            </p>
          </article>
          <article className="feature-item">
            <h3>Production control</h3>
            <p>
              Production deployment remains gated by CI, verification locks, required secrets, signoffs, and smoke checks.
              Launch or deployment controls require documented approval.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}

export function TrustSafetyPage() {
  return (
    <main className="page-shell legal-page">
      <section className="panel">
        <div className="eyebrow">Trust & Safety</div>
        <h1>Operational safeguards</h1>
        <p>
          URAI Jobs is designed around observable, recoverable background execution. Production launch remains gated until
          engineering, security/privacy, domain/SSL, and product signoffs are complete.
        </p>
        <div className="status-grid">
          <article><strong>Auditability</strong><span>Job creation, retries, cancellations, logs, and failures are designed to remain traceable.</span></article>
          <article><strong>Least privilege</strong><span>Admin and operator actions should be limited to trusted URAI users with approved claims.</span></article>
          <article><strong>Recovery</strong><span>Dead-letter, retry, stale lease, and reconciliation workflows support incident response.</span></article>
          <article><strong>Launch lock</strong><span>Production deployment is blocked until signoffs, secrets, CI, domain, and smoke checks pass.</span></article>
        </div>
      </section>
    </main>
  );
}
