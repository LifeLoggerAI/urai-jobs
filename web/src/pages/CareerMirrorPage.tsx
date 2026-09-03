import { useMemo, useState } from "react";
import { createJob } from "../lib/jobsApi";
import {
  explainFit,
  type CareerOpportunity,
  type WorkPreferenceProfile
} from "../lib/careerMirror";
import {
  loadCareerMirrorState,
  resetCareerMirrorState,
  saveCareerMirrorState,
  type CareerMirrorState
} from "../lib/careerMirrorStore";

type RuntimeJobState = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
  jobId?: string;
};

const idleRuntimeJob: RuntimeJobState = { status: "idle", message: "" };

export function CareerMirrorPage() {
  const [mirrorState, setMirrorState] = useState<CareerMirrorState>(() => loadCareerMirrorState());
  const [profileJob, setProfileJob] = useState<RuntimeJobState>(idleRuntimeJob);
  const [fitJob, setFitJob] = useState<RuntimeJobState>(idleRuntimeJob);

  const profile = mirrorState.profile;
  const opportunities = mirrorState.opportunities;
  const selectedId = mirrorState.selectedId;

  const visibleOpportunities = useMemo(() => opportunities.filter((item) => !item.hidden), [opportunities]);
  const selected = visibleOpportunities.find((item) => item.id === selectedId) ?? visibleOpportunities[0];

  function persist(update: Partial<CareerMirrorState>) {
    setMirrorState((current) => saveCareerMirrorState({ ...current, ...update }));
  }

  function updateProfile(update: Partial<WorkPreferenceProfile>) {
    persist({ profile: { ...profile, ...update } });
  }

  function updateOpportunity(id: string, update: Partial<CareerOpportunity>) {
    persist({ opportunities: opportunities.map((item) => (item.id === id ? { ...item, ...update } : item)) });
  }

  function selectOpportunity(id: string) {
    persist({ selectedId: id });
  }

  function hideOpportunity(id: string) {
    const nextOpportunities = opportunities.map((item) => (item.id === id ? { ...item, hidden: true } : item));
    const nextVisible = nextOpportunities.filter((item) => !item.hidden);
    persist({ opportunities: nextOpportunities, selectedId: nextVisible[0]?.id ?? "" });
  }

  function resetMirror() {
    setMirrorState(resetCareerMirrorState());
    setProfileJob(idleRuntimeJob);
    setFitJob(idleRuntimeJob);
  }

  async function runProfileSummary() {
    setProfileJob({ status: "loading", message: "Creating career.profile.summarize job..." });
    try {
      const result = await createJob("career.profile.summarize", {
        profile,
        source: "career-mirror-v1",
        outputPrefix: "career-mirror/profile-summary"
      });
      const jobId = String(result.jobId || result.id || "created");
      setProfileJob({ status: "success", jobId, message: `Profile summary job created: ${jobId}` });
    } catch (error) {
      setProfileJob({ status: "error", message: error instanceof Error ? error.message : "Profile summary job failed." });
    }
  }

  async function runFitScore() {
    if (!selected) return;
    setFitJob({ status: "loading", message: "Creating career.fit.score job..." });
    try {
      const result = await createJob("career.fit.score", {
        profile,
        opportunity: selected,
        source: "career-mirror-v1",
        outputPrefix: `career-mirror/fit-score/${selected.id}`
      });
      const jobId = String(result.jobId || result.id || "created");
      setFitJob({ status: "success", jobId, message: `Fit score job created: ${jobId}` });
    } catch (error) {
      setFitJob({ status: "error", message: error instanceof Error ? error.message : "Fit score job failed." });
    }
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
            <button type="button" className="secondary-button" onClick={() => void runProfileSummary()} disabled={profileJob.status === "loading"}>
              {profileJob.status === "loading" ? "Creating profile job..." : "Summarize profile"}
            </button>
            <button type="button" className="secondary-button" onClick={resetMirror}>Reset V1 state</button>
          </div>
          {profileJob.status !== "idle" && (
            <div className={`notice ${profileJob.status}`}>
              <strong>{profileJob.status.toUpperCase()}</strong>
              <p>{profileJob.message}</p>
              {profileJob.jobId && <a className="secondary-button" href="/admin">View in admin</a>}
            </div>
          )}
        </div>

        <aside className="hero-card">
          <div className="eyebrow">Work Preference Profile</div>
          <ul className="check-list">
            <li>Mode: {profile.preferredMode}</li>
            <li>Autonomy: {profile.autonomy}</li>
            <li>Meeting load: {profile.meetingLoad}</li>
            <li>Rhythm: {profile.workRhythm}</li>
            <li>Saved locally: {new Date(mirrorState.updatedAt).toLocaleString()}</li>
          </ul>
        </aside>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div className="eyebrow">V1 profile controls</div>
          <h2>Editable work rhythm, persisted locally.</h2>
          <p>
            These controls establish the V1 data model before replacing local persistence with authenticated,
            user-scoped storage.
          </p>
        </div>

        <div className="features-grid career-profile-grid">
          <label className="feature-item">
            Preferred mode
            <select value={profile.preferredMode} onChange={(event) => updateProfile({ preferredMode: event.target.value as WorkPreferenceProfile["preferredMode"] })}>
              <option value="remote">remote</option>
              <option value="hybrid">hybrid</option>
              <option value="onsite">onsite</option>
              <option value="flexible">flexible</option>
            </select>
          </label>
          <label className="feature-item">
            Autonomy
            <select value={profile.autonomy} onChange={(event) => updateProfile({ autonomy: event.target.value as WorkPreferenceProfile["autonomy"] })}>
              <option value="low">low</option>
              <option value="balanced">balanced</option>
              <option value="high">high</option>
            </select>
          </label>
          <label className="feature-item">
            Meeting load
            <select value={profile.meetingLoad} onChange={(event) => updateProfile({ meetingLoad: event.target.value as WorkPreferenceProfile["meetingLoad"] })}>
              <option value="low">low</option>
              <option value="balanced">balanced</option>
              <option value="high">high</option>
            </select>
          </label>
          <label className="feature-item">
            Work rhythm
            <select value={profile.workRhythm} onChange={(event) => updateProfile({ workRhythm: event.target.value as WorkPreferenceProfile["workRhythm"] })}>
              <option value="deep-work">deep-work</option>
              <option value="collaborative">collaborative</option>
              <option value="mixed">mixed</option>
            </select>
          </label>
          <label className="feature-item career-wide-field">
            Growth goal
            <textarea rows={4} value={profile.growthGoal} onChange={(event) => updateProfile({ growthGoal: event.target.value })} />
          </label>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div className="eyebrow">V1 boundary</div>
          <h2>Career intelligence, not manual review.</h2>
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
                onClick={() => selectOpportunity(item.id)}
              >
                <strong>{item.title}</strong>
                <span>{item.organization}</span>
                <span>{item.fitScore}% fit · {item.mode}</span>
                {item.saved && <span>saved</span>}
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
                <button type="button" className="secondary-button" onClick={() => void runFitScore()} disabled={fitJob.status === "loading"}>
                  {fitJob.status === "loading" ? "Creating score job..." : "Run runtime score"}
                </button>
              </div>

              {fitJob.status !== "idle" && (
                <div className={`notice ${fitJob.status}`}>
                  <strong>{fitJob.status.toUpperCase()}</strong>
                  <p>{fitJob.message}</p>
                  {fitJob.jobId && <a className="secondary-button" href="/admin">View in admin</a>}
                </div>
              )}
            </article>
          ) : (
            <article className="panel">
              <div className="eyebrow">No visible opportunities</div>
              <h1>All opportunities hidden.</h1>
              <p>Use Reset V1 state to restore the seeded opportunity queue.</p>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}
