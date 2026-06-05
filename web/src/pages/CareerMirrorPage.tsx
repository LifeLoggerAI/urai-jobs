import { useMemo, useState } from "react";
import {
  careerMirrorOpportunities,
  defaultWorkPreferenceProfile,
  explainFit,
  type CareerOpportunity
} from "../lib/careerMirror";

export function CareerMirrorPage() {
  const [opportunities, setOpportunities] = useState<CareerOpportunity[]>(careerMirrorOpportunities);
  const [selectedId, setSelectedId] = useState(careerMirrorOpportunities[0]?.id ?? "");
  const profile = defaultWorkPreferenceProfile;

  const visibleOpportunities = useMemo(() => opportunities.filter((item) => !item.hidden), [opportunities]);
  const selected = visibleOpportunities.find((item) => item.id === selectedId) ?? visibleOpportunities[0];

  function updateOpportunity(id: string, update: Partial<CareerOpportunity>) {
    setOpportunities((current) => current.map((item) => (item.id === id ? { ...item, ...update } : item)));
  }

  function hideOpportunity(id: string) {
    updateOpportunity(id, { hidden: true });
    const next = visibleOpportunities.find((item) => item.id !== id);
    setSelectedId(next?.id ?? "");
  }

  return (
    <main className="page-shell career-mirror-shell">
      <section className="hero hero-grid career-mirror-hero">
        <div>
          <div className="eyebrow">Career Mirror V1</div>
          <h1>Find work that fits how you actually operate.</h1>
          <p>
            This V1 scaffold keeps the public Career Mirror separate from the internal runtime UI. It shows
            work preferences, opportunity fit, save/hide controls, and explainable match reasoning without
            sending external applications.
          </p>
          <div className="hero-actions">
            <a className="cta-button" href="#opportunities">Review opportunities</a>
            <a className="secondary-button" href="/create">Create career runtime job</a>
          </div>
        </div>

        <aside className="hero-card">
          <div className="eyebrow">Work Preference Profile</div>
          <ul className="check-list">
            <li>Mode: {profile.preferredMode}</li>
            <li>Autonomy: {profile.autonomy}</li>
            <li>Meeting load: {profile.meetingLoad}</li>
            <li>Rhythm: {profile.workRhythm}</li>
          </ul>
        </aside>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div className="eyebrow">V1 boundary</div>
          <h2>Career intelligence, not auto-apply.</h2>
          <p>
            V1 is intentionally advisory: it can summarize, score, save, hide, and explain opportunities.
            External actions stay out of scope until later consent-gated versions.
          </p>
        </div>

        <div className="features-grid career-profile-grid">
          <article className="feature-item">
            <h3>Growth goal</h3>
            <p>{profile.growthGoal}</p>
          </article>
          <article className="feature-item">
            <h3>Avoid patterns</h3>
            <p>{profile.avoidPatterns.join(", ")}</p>
          </article>
          <article className="feature-item">
            <h3>Runtime hooks</h3>
            <p>Designed to call career.profile.summarize and career.fit.score through the URAI Jobs runtime.</p>
          </article>
        </div>
      </section>

      <section className="section-block" id="opportunities">
        <div className="section-heading">
          <div className="eyebrow">Manual Discovery</div>
          <h2>Opportunity fit queue.</h2>
          <p>These seeded examples prove the V1 interaction model before connecting live opportunity ingestion.</p>
        </div>

        <div className="career-grid">
          <div className="career-list">
            {visibleOpportunities.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === selected?.id ? "preset-card active" : "preset-card"}
                onClick={() => setSelectedId(item.id)}
              >
                <strong>{item.title}</strong>
                <span>{item.organization}</span>
                <span>{item.fitScore}% fit · {item.mode}</span>
              </button>
            ))}
          </div>

          {selected ? (
            <article className="panel career-detail-panel">
              <div className="eyebrow">Explain Match</div>
              <h1>{selected.title}</h1>
              <p>{explainFit(selected, profile)}</p>

              <div className="status-grid">
                <article>
                  <strong>{selected.fitScore}%</strong>
                  <span>Fit score</span>
                </article>
                <article>
                  <strong>{selected.stressRisk}</strong>
                  <span>Stress risk</span>
                </article>
                <article>
                  <strong>{selected.growthFit}</strong>
                  <span>Growth fit</span>
                </article>
              </div>

              <div className="hero-actions compact">
                <button type="button" onClick={() => updateOpportunity(selected.id, { saved: !selected.saved })}>
                  {selected.saved ? "Saved" : "Save"}
                </button>
                <button type="button" className="secondary-button" onClick={() => hideOpportunity(selected.id)}>
                  Hide
                </button>
              </div>
            </article>
          ) : (
            <article className="panel">
              <div className="eyebrow">No visible opportunities</div>
              <h1>All opportunities hidden.</h1>
              <p>Refresh the page to reset the V1 scaffold data.</p>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}
