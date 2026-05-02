import { useState } from "react";
import { createJob } from "../lib/jobsApi";

const DEFAULT_PAYLOAD = JSON.stringify(
  {
    text: "URAI Jobs production smoke test",
    voice: "en-US-Wavenet-D",
    locale: "en-US",
    format: "mp3",
    outputPrefix: "prod-smoke-test"
  },
  null,
  2
);

export function CreateJobPage() {
  const [jobType, setJobType] = useState("narrator.tts");
  const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const parsed = JSON.parse(payload);
      const result = await createJob(jobType, parsed);
      setStatus("success");
      setMessage(`Job created: ${result.jobId || result.id || "created"}`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Create job failed.");
    }
  }

  return (
    <main className="page-shell">
      <section className="panel">
        <div className="eyebrow">Create Job</div>
        <h1>Submit a production job</h1>
        <p>This calls the live Firebase callable function <code>createJob</code>.</p>

        <form onSubmit={submit} className="form-stack">
          <label>
            Job Type
            <input value={jobType} onChange={(event) => setJobType(event.target.value)} />
          </label>

          <label>
            Payload JSON
            <textarea rows={14} value={payload} onChange={(event) => setPayload(event.target.value)} />
          </label>

          <button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Creating..." : "Create Job"}
          </button>
        </form>

        {status !== "idle" && (
          <div className={`notice ${status}`}>
            <strong>{status.toUpperCase()}</strong>
            <p>{message}</p>
          </div>
        )}
      </section>
    </main>
  );
}
