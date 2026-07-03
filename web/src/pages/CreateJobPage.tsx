import { useMemo, useState, type FormEvent } from "react";
import { createJob } from "../lib/jobsApi";

const careerProfile = {
  preferredMode: "flexible",
  autonomy: "high",
  meetingLoad: "low",
  workRhythm: "deep-work",
  growthGoal: "Find work that supports focused building, creative systems thinking, and long-term ownership.",
  avoidPatterns: ["unclear ownership", "heavy meeting load", "commission-only structure"]
};

const careerOpportunity = {
  id: "urai-career-ai-product-builder",
  title: "AI Product Builder",
  organization: "Mission-driven product team",
  mode: "flexible",
  fitScore: 94,
  stressRisk: "low",
  growthFit: "high"
};

const PRESETS = {
  "narrator.tts": {
    label: "Narrator TTS",
    payload: {
      text: "URAI Jobs runtime smoke test",
      voice: "en-US-Wavenet-D",
      locale: "en-US",
      format: "MP3",
      outputPrefix: "runtime-smoke-test"
    }
  },
  "asset.render": {
    label: "Asset render",
    payload: { assetType: "preview-card", template: "urai-default", outputPrefix: "asset-smoke-test" }
  },
  "spatial.index": {
    label: "Spatial index",
    payload: { source: "smoke-test", mode: "incremental", outputPrefix: "spatial-smoke-test" }
  },
  "career.profile.summarize": {
    label: "Career profile summary",
    payload: { source: "operator-preset", profile: careerProfile, outputPrefix: "career-smoke/profile-summary" }
  },
  "career.fit.score": {
    label: "Career fit score",
    payload: { source: "operator-preset", profile: careerProfile, opportunity: careerOpportunity, outputPrefix: "career-smoke/fit-score" }
  },
  "career.document.parse": {
    label: "Career document parse",
    payload: { source: "operator-preset", documentRef: "gs://urai-jobs-sample-inputs/career/profile.md", outputPrefix: "career-smoke/document-parse" }
  },
  "career.document.tailor": {
    label: "Career document tailor",
    payload: { source: "operator-preset", profile: careerProfile, opportunity: careerOpportunity, documentRef: "gs://urai-jobs-sample-inputs/career/profile.md", outputPrefix: "career-smoke/document-tailor" }
  },
  "career.packet.generate": {
    label: "Career packet generate",
    payload: { source: "operator-preset", profile: careerProfile, opportunity: careerOpportunity, outputPrefix: "career-smoke/packet" }
  },
  "career.followup.plan": {
    label: "Career follow-up plan",
    payload: { source: "operator-preset", opportunity: careerOpportunity, cadence: "review-only", outputPrefix: "career-smoke/followup-plan" }
  },
  "career.interview.prep": {
    label: "Career interview prep",
    payload: { source: "operator-preset", profile: careerProfile, opportunity: careerOpportunity, outputPrefix: "career-smoke/interview-prep" }
  },
  "career.offer.compare": {
    label: "Career offer compare",
    payload: {
      source: "operator-preset",
      profile: careerProfile,
      offers: [
        { id: "offer-a", title: "AI Product Builder", compensation: "TBD", mode: "flexible" },
        { id: "offer-b", title: "Spatial Experience Lead", compensation: "TBD", mode: "hybrid" }
      ],
      outputPrefix: "career-smoke/offer-compare"
    }
  },
  "career.spatial.portal.generate": {
    label: "Career spatial portal",
    payload: { source: "operator-preset", profile: careerProfile, opportunity: careerOpportunity, outputPrefix: "career-smoke/spatial-portal" }
  },
  "career.passport.export": {
    label: "Career Passport export",
    payload: { source: "operator-preset", profile: careerProfile, consentScope: "private-preview", outputPrefix: "career-smoke/passport-export" }
  }
};

type PresetKey = keyof typeof PRESETS;

function stringify(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function CreateJobPage() {
  const [jobType, setJobType] = useState<PresetKey>("narrator.tts");
  const [payload, setPayload] = useState(stringify(PRESETS["narrator.tts"].payload));
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [createdJobId, setCreatedJobId] = useState("");

  const payloadIsValid = useMemo(() => {
    try {
      JSON.parse(payload);
      return true;
    } catch {
      return false;
    }
  }, [payload]);

  function selectPreset(nextType: PresetKey) {
    setJobType(nextType);
    setPayload(stringify(PRESETS[nextType].payload));
    setStatus("idle");
    setMessage("");
    setCreatedJobId("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    setCreatedJobId("");

    try {
      const parsed = JSON.parse(payload);
      const result = await createJob(jobType, parsed);
      const id = String(result.jobId || result.id || "created");
      setCreatedJobId(id);
      setStatus("success");
      setMessage(`Job created successfully: ${id}`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Create job failed.");
    }
  }

  async function copyJobId() {
    if (!createdJobId) return;
    await navigator.clipboard?.writeText(createdJobId);
  }

  return (
    <main className="page-shell">
      <section className="panel">
        <div className="eyebrow">Protected Operator Workflow</div>
        <h1>Submit controlled runtime work.</h1>
        <p>
          This route is gated in the web app and by Firebase callable authorization. Use it only for
          operator smoke tests and approved subsystem integration checks.
        </p>

        <div className="notice">
          <strong>Authorization required</strong>
          <p>Only admin, operator, or explicit job-create claims may use this screen.</p>
        </div>

        <div className="preset-grid">
          {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
            <button className={key === jobType ? "preset-card active" : "preset-card"} key={key} type="button" onClick={() => selectPreset(key)}>
              <strong>{PRESETS[key].label}</strong>
              <span>{key}</span>
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="form-stack">
          <label>
            Job Type
            <input value={jobType} onChange={(event) => setJobType(event.target.value as PresetKey)} />
          </label>
          <label>
            Payload JSON
            <textarea rows={14} value={payload} onChange={(event) => setPayload(event.target.value)} />
          </label>
          <div className="form-actions">
            <button type="submit" disabled={status === "loading" || !payloadIsValid}>{status === "loading" ? "Creating..." : "Create Job"}</button>
            {!payloadIsValid && <span className="form-hint danger-text">Payload JSON is invalid.</span>}
          </div>
        </form>

        {status !== "idle" && (
          <div className={`notice ${status}`}>
            <strong>{status === "success" ? "SUCCESS" : status.toUpperCase()}</strong>
            <p>{message}</p>
            {createdJobId && (
              <div className="hero-actions compact">
                <button type="button" onClick={() => void copyJobId()}>Copy job ID</button>
                <a className="secondary-button" href="/admin">Open admin</a>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
