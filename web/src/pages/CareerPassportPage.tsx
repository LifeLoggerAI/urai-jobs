import { useMemo, useState } from "react";
import { createJob } from "../lib/jobsApi";
import {
  buildPassportExportPayload,
  careerPassportSeed,
  type CareerMode,
  type CareerPassportState
} from "../lib/careerPassport";

type RuntimeJobState = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
  jobId?: string;
};

const idleRuntimeJob: RuntimeJobState = { status: "idle", message: "" };

export function CareerPassportPage() {
  const [state, setState] = useState<CareerPassportState>(careerPassportSeed);
  const [passportJob, setPassportJob] = useState<RuntimeJobState>(idleRuntimeJob);
  const exportPayload = useMemo(() => buildPassportExportPayload(state), [state]);

  function setMode(mode: CareerMode) {
    setState((current) => ({ ...current, activeMode: mode }));
  }

  async function runPassportExport() {
    setPassportJob({ status: "loading", message: "Creating career.passport.export job..." });
    try {
      const result = await createJob("career.passport.export", {
        source: "career-passport-v5",
        passport: state,
        exportPayload,
        outputPrefix: `career-passport/export/${state.activeMode}`
      });
      const jobId = String(result.jobId || result.id || "created");
      setPassportJob({ status: "success", jobId, message: `Passport export job created: ${jobId}` });
    } catch (error) {
      setPassportJob({ status: "error", message: error instanceof Error ? error.message : "Passport export job failed." });
    }
  }

  return (
    <main className="page-shell career-passport-shell">
      <section className="hero career-mirror-hero">
        <div className="eyebrow">Career Passport V5</div>
        <h1>Economic path graph and revocable profile packets.</h1>
        <p>
          V5 expands URAI-Jobs into a user-controlled career identity and economic path system. Passport packets
          remain private or review-scoped and can be exported through the approved runtime job.
        </p>
        <div className="hero-actions">
          <button type="button" onClick={() => void runPassportExport()} disabled={passportJob.status === "loading"}>
            {passportJob.status === "loading" ? "Creating export job..." : "Export Passport packet"}
          </button>
          <a className="secondary-button" href="/career-decision">Open Decision V4</a>
          <a className="secondary-button" href="/career-versions">View version console</a>
        </div>
        {passportJob.status !== "idle" && (
          <div className={`notice ${passportJob.status}`}>
            <strong>{passportJob.status.toUpperCase()}</strong>
            <p>{passportJob.message}</p>
            {passportJob.jobId && <a className="secondary-button" href="/admin">View in admin</a>}
          </div>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div className="eyebrow">Mode</div>
          <h2>Choose the economic lens.</h2>
          <p>Active mode: {state.activeMode}</p>
        </div>
        <div className="hero-actions compact">
          {(["founder", "freelancer", "employee", "student", "rebuild"] as CareerMode[]).map((mode) => (
            <button type="button" className={state.activeMode === mode ? "preset-card active" : "secondary-button"} key={mode} onClick={() => setMode(mode)}>
              {mode}
            </button>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div className="eyebrow">Passport packets</div>
          <h2>User-controlled career identity.</h2>
        </div>
        <div className="features-grid">
          {state.packets.map((packet) => (
            <article className="feature-item" key={packet.id}>
              <div className="launch-stage-header">
                <div>
                  <div className="eyebrow">{packet.visibility}</div>
                  <h3>{packet.label}</h3>
                </div>
                <span className="launch-status">{packet.mode}</span>
              </div>
              <p>Strengths: {packet.strengths.join(", ")}</p>
              <p>Preferences: {packet.workPreferences.join(", ")}</p>
              <ul className="check-list">
                {packet.consentNotes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div className="eyebrow">Economic path graph</div>
          <h2>Multiple path categories, one user-owned map.</h2>
        </div>
        <div className="features-grid">
          {state.pathNodes.map((node) => (
            <article className="feature-item" key={node.id}>
              <div className="eyebrow">{node.stage} · {node.category}</div>
              <h3>{node.label}</h3>
              <p>Fit: {node.fit}</p>
              <ul className="check-list">
                {node.notes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div className="eyebrow">Skill gaps</div>
          <h2>Turn missing skills into suggested projects.</h2>
        </div>
        <div className="features-grid">
          {state.skillGaps.map((gap) => (
            <article className="feature-item" key={gap.id}>
              <div className="eyebrow">{gap.priority}</div>
              <h3>{gap.skill}</h3>
              <p>{gap.suggestedProject}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
