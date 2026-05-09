import { useMemo, useState } from "react";
import { createJob } from "../lib/jobsApi";

const PRESETS = {
  "narrator.tts": {
    label: "Narrator TTS",
    payload: {
      text: "URAI Jobs production smoke test",
      voice: "en-US-Wavenet-D",
      locale: "en-US",
      format: "MP3",
      outputPrefix: "prod-smoke-test"
    }
  },
  "asset.render": {
    label: "Asset render",
    payload: {
      assetType: "preview-card",
      template: "urai-default",
      outputPrefix: "asset-smoke-test"
    }
  },
  "spatial.index": {
    label: "Spatial index",
    payload: {
      source: "smoke-test",
      mode: "incremental",
      outputPrefix: "spatial-smoke-test"
    }
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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
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
        <div className="eyebrow">Create Job</div>
        <h1>Submit controlled production work.</h1>
        <p>
          Choose a preset, inspect the payload, then submit it to the live Firebase callable function.
          Use this for smoke tests, operator workflows, and subsystem integration checks.
        </p>

        <div className="preset-grid">
          {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
            <button
              className={key === jobType ? "preset-card active" : "preset-card"}
              key={key}
              type="button"
              onClick={() => selectPreset(key)}
            >
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
            <button type="submit" disabled={status === "loading" || !payloadIsValid}>
              {status === "loading" ? "Creating..." : "Create Job"}
            </button>
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
