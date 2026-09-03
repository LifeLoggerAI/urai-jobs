import { careerLaunchPlan } from "../lib/careerLaunchPlan";

export function CareerVersionConsolePage() {
  return (
    <main className="page-shell career-launch-shell">
      <section className="hero career-mirror-hero">
        <div className="eyebrow">URAI-Jobs Version Console</div>
        <h1>V1 through V5, visible and gated.</h1>
        <p>
          This console tracks the autonomous URAI-Jobs version arc while preserving the runtime/product boundary.
          It is a product scaffold, not a replacement for production release evidence.
        </p>
        <div className="hero-actions">
          <a className="cta-button" href="/career-mirror">Open Career Mirror</a>
          <a className="secondary-button" href="/create">Smoke test runtime jobs</a>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div className="eyebrow">Version gates</div>
          <h2>Every version has runtime jobs and product gates.</h2>
          <p>
            Each stage below maps to the committed product decision and can be turned into implementation work
            without mixing public marketplace behavior into the internal operator runtime.
          </p>
        </div>

        <div className="launch-stage-grid">
          {careerLaunchPlan.map((stage) => (
            <article className="feature-item launch-stage-card" key={stage.version}>
              <div className="launch-stage-header">
                <div>
                  <div className="eyebrow">{stage.version}</div>
                  <h3>{stage.title}</h3>
                </div>
                <span className={`launch-status ${stage.status}`}>{stage.status}</span>
              </div>
              <p>{stage.summary}</p>

              <div className="hero-actions compact">
                <a className="secondary-button" href={stage.href}>Open {stage.version}</a>
              </div>

              <h4>Product gates</h4>
              <ul className="check-list">
                {stage.gates.map((gate) => (
                  <li key={gate}>{gate}</li>
                ))}
              </ul>

              <h4>Runtime jobs</h4>
              <div className="runtime-chip-row">
                {stage.runtimeJobs.map((jobType) => (
                  <code key={jobType}>{jobType}</code>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
