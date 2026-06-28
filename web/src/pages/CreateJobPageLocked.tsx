import { useMemo, useState, type FormEvent } from "react";
import { createJob } from "../lib/jobsApi";

const DEFAULT_PAYLOAD = {
  text: "URAI Jobs controlled lifecycle check",
  voice: "en-US-Wavenet-D",
  locale: "en-US",
  format: "MP3",
  outputPrefix: "operator-check"
};

function stringify(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function CreateJobPageLocked() {
  const [payload, setPayload] = useState(stringify(DEFAULT_PAYLOAD));
  const [idempotencyKey, setIdempotencyKey] = useState(`operator-${Date.now()}`);
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    setCreatedJobId("");

    try {
      const result = await createJob("narrator.tts", JSON.parse(payload), idempotencyKey.trim() || undefined);
      const id = String(result.jobId || result.id || "created");
      setCreatedJobId(id);
      setStatus("success");
      setMessage(result.idempotent ? `Existing idempotent job returned: ${id}` : `Job created successfully: ${id}`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Create job failed.");
    }
  }

  return (
    <main className="page-shell">
      <section className="panel">
        <div className="eyebrow">Create Job</div>
        <h1>Submit controlled URAI Jobs work.</h1>
        <p>This signed-in surface is locked to the currently implemented safe job type: narrator.tts.</p>
        <div className="notice">
          <strong>Production boundary</strong>
          <p>Other worker families are blocked until real execution and lifecycle proof exist.</p>
        </div>
        <form onSubmit={submit} className="form-stack">
          <label>Job Type<input value="narrator.tts" readOnly /></label>
          <label>Idempotency Key<input value={idempotencyKey} onChange={(event) => setIdempotencyKey(event.target.value)} /></label>
          <label>Payload JSON<textarea rows={14} value={payload} onChange={(event) => setPayload(event.target.value)} /></label>
          <div className="form-actions">
            <button type="submit" disabled={status === "loading" || !payloadIsValid}>{status === "loading" ? "Creating..." : "Create Job"}</button>
            {!payloadIsValid && <span className="form-hint danger-text">Payload JSON is invalid.</span>}
          </div>
        </form>
        {status !== "idle" && (
          <div className={`notice ${status}`}>
            <strong>{status === "success" ? "SUCCESS" : status.toUpperCase()}</strong>
            <p>{message}</p>
            {createdJobId && <a className="secondary-button" href="/admin">Open admin</a>}
          </div>
        )}
      </section>
    </main>
  );
}
