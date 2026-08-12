const careerSurfaces = [
  {
    title: "Career Mirror",
    href: "/career-mirror",
    body: "Bring your work preferences, saved opportunities, and fit signals into one private view you can adjust over time."
  },
  {
    title: "Opportunity Marketplace",
    href: "/career-marketplace",
    body: "Review opportunities and supporting material with clear fit context instead of opaque ranking."
  },
  {
    title: "Automation Controls",
    href: "/career-automation",
    body: "Choose what URAI may watch or prepare for you, pause individual rules, and review activity before it becomes noise."
  },
  {
    title: "Decision Layer",
    href: "/career-decision",
    body: "Prepare for interviews, compare offers, and weigh tradeoffs while keeping uncertainty visible."
  },
  {
    title: "Career Passport",
    href: "/career-passport",
    body: "Keep a user-controlled career profile, skills record, preferences, and portable career packet in one place."
  }
];

const principles = [
  {
    title: "Explain the fit",
    body: "Recommendations should show the signals that contributed to a match rather than hiding behind a single score."
  },
  {
    title: "Keep the person in control",
    body: "Saved opportunities, preferences, automation rules, and shared career information remain reviewable and changeable."
  },
  {
    title: "Separate signal from fact",
    body: "Fit, burnout risk, and future-path guidance are presented as estimates and observations—not unquestionable conclusions."
  }
];

export function LandingPage() {
  return (
    <div className="landing-page">
      <main className="page-shell">
        <section className="hero hero-grid" aria-labelledby="jobs-title">
          <div>
            <div className="eyebrow">URAI Career</div>
            <h1 id="jobs-title">A career space that helps you see where your work life could go next.</h1>
            <p>
              URAI Career brings preferences, opportunities, preparation, decisions, and a portable career profile into one connected experience—without turning your working life into another dashboard you have to constantly maintain.
            </p>

            <div className="hero-actions">
              <a href="/career-mirror" className="cta-button">Open Career Mirror</a>
              <a href="/career-marketplace" className="secondary-button">Explore opportunities</a>
            </div>
          </div>

          <aside className="hero-card" aria-label="Career experience">
            <div className="eyebrow">Your path</div>
            <ul className="check-list">
              <li>Review work preferences and fit signals</li>
              <li>Save and compare opportunities</li>
              <li>Prepare for interviews and decisions</li>
              <li>Control career automations</li>
              <li>Keep a portable Career Passport</li>
            </ul>
          </aside>
        </section>

        <section className="section-block" aria-labelledby="career-surfaces-title">
          <div className="section-heading">
            <div className="eyebrow">One connected career experience</div>
            <h2 id="career-surfaces-title">Move from reflection to opportunity to decision.</h2>
            <p>
              Each part of URAI Career has a distinct job: understand what fits, find possibilities, prepare carefully, and keep the final choice with you.
            </p>
          </div>

          <div className="features-grid">
            {careerSurfaces.map((surface) => (
              <article className="feature-item" key={surface.title}>
                <h3>{surface.title}</h3>
                <p>{surface.body}</p>
                <div className="hero-actions compact">
                  <a href={surface.href} className="secondary-button">Open {surface.title}</a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block" aria-labelledby="career-principles-title">
          <div className="section-heading">
            <div className="eyebrow">Built around agency</div>
            <h2 id="career-principles-title">Useful guidance without pretending to know your future.</h2>
            <p>
              Career intelligence should make tradeoffs easier to see while preserving uncertainty, privacy, and the right to ignore a recommendation.
            </p>
          </div>

          <div className="features-grid">
            {principles.map((principle) => (
              <article className="feature-item" key={principle.title}>
                <h3>{principle.title}</h3>
                <p>{principle.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="call-to-action" aria-labelledby="career-cta-title">
          <div>
            <div className="eyebrow">Start with your work life</div>
            <h2 id="career-cta-title">See your current career picture before changing it.</h2>
            <p>Career Mirror is the quietest place to begin: review what matters to you, then decide whether to explore opportunities or turn on any automation.</p>
          </div>
          <div className="hero-actions">
            <a href="/career-mirror" className="cta-button">Open Career Mirror</a>
          </div>
        </section>
      </main>
    </div>
  );
}
