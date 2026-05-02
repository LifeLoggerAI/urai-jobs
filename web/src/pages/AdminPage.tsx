import { useEffect, useMemo, useState } from "react";
import {
  cancelJob,
  getJob,
  listJobLogs,
  listJobs,
  retryJob,
  type JobLogRecord,
  type JobRecord,
  type JobStatus
} from "../lib/jobsApi";

const STATUSES: JobStatus[] = ["queued", "running", "succeeded", "failed", "retry_needed", "cancelled"];

type JobsByStatus = Record<JobStatus, JobRecord[]>;

const emptyJobsByStatus = (): JobsByStatus => ({
  queued: [],
  running: [],
  succeeded: [],
  failed: [],
  retry_needed: [],
  cancelled: []
});

function jobKey(job: JobRecord): string {
  return String(job.id || job.jobId || "unknown-job");
}

function jobLabel(job: JobRecord): string {
  return String(job.jobType || job.type || "unknown");
}

function renderJson(value: unknown) {
  if (value === undefined || value === null || value === "") return "—";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function AdminPage() {
  const [jobsByStatus, setJobsByStatus] = useState<JobsByStatus>(emptyJobsByStatus);
  const [selectedJob, setSelectedJob] = useState<JobRecord | null>(null);
  const [selectedLogs, setSelectedLogs] = useState<JobLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const totalJobs = useMemo(
    () => STATUSES.reduce((sum, status) => sum + jobsByStatus[status].length, 0),
    [jobsByStatus]
  );

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const entries = await Promise.all(
        STATUSES.map(async (status) => {
          const result = await listJobs(status);
          return [status, result.jobs || []] as const;
        })
      );

      const next = emptyJobsByStatus();
      for (const [status, jobs] of entries) next[status] = jobs;
      setJobsByStatus(next);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Failed to load jobs.");
    } finally {
      setLoading(false);
    }
  }

  async function openJob(job: JobRecord) {
    const id = jobKey(job);
    setActionPending(`view:${id}`);
    setError("");
    setNotice("");

    try {
      const detail = await getJob(id);
      const logs = await listJobLogs(id);
      setSelectedJob(detail.job || job);
      setSelectedLogs(logs.logs || detail.logs || []);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Failed to load job detail.");
    } finally {
      setActionPending(null);
    }
  }

  async function retry(id: string) {
    setActionPending(`retry:${id}`);
    setError("");
    setNotice("");

    try {
      await retryJob(id);
      setNotice(`Retry queued for ${id}.`);
      await refresh();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Retry failed.");
    } finally {
      setActionPending(null);
    }
  }

  async function cancel(id: string) {
    setActionPending(`cancel:${id}`);
    setError("");
    setNotice("");

    try {
      await cancelJob(id);
      setNotice(`Cancelled ${id}.`);
      await refresh();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Cancel failed.");
    } finally {
      setActionPending(null);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "2rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
        <div>
          <h1>URAI Jobs Admin</h1>
          <p>Live Firebase-backed operator dashboard for queue, execution, retry, cancel, payload, output, and logs.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

      {error && (
        <section style={{ border: "1px solid #b91c1c", padding: "1rem", margin: "1rem 0" }}>
          <strong>Error</strong>
          <p>{error}</p>
        </section>
      )}

      {notice && (
        <section style={{ border: "1px solid #15803d", padding: "1rem", margin: "1rem 0" }}>
          <strong>Success</strong>
          <p>{notice}</p>
        </section>
      )}

      {loading && <p>Loading live job data...</p>}
      {!loading && totalJobs === 0 && <p>No jobs returned by the backend yet.</p>}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
        {STATUSES.map((status) => (
          <article key={status} style={{ border: "1px solid #ccc", borderRadius: 8, padding: "1rem" }}>
            <h2 style={{ textTransform: "capitalize" }}>
              {status.replace("_", " ")} ({jobsByStatus[status].length})
            </h2>

            {jobsByStatus[status].length === 0 ? (
              <p>No {status.replace("_", " ")} jobs.</p>
            ) : (
              jobsByStatus[status].map((job) => {
                const id = jobKey(job);
                const canRetry = status === "failed" || status === "retry_needed";
                const canCancel = status === "queued" || status === "running";

                return (
                  <div key={id} style={{ borderTop: "1px solid #ddd", paddingTop: "0.75rem", marginTop: "0.75rem" }}>
                    <strong>{jobLabel(job)}</strong>
                    <p>ID: {id}</p>
                    <p>Owner: {String(job.ownerSubsystem || job.ownerUid || job.createdBy || "—")}</p>
                    <p>
                      Attempts: {job.attempts ?? 0}
                      {job.maxAttempts !== undefined ? ` / ${job.maxAttempts}` : ""}
                    </p>
                    {job.error !== undefined && <pre>{renderJson(job.error)}</pre>}

                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button type="button" onClick={() => void openJob(job)} disabled={Boolean(actionPending)}>
                        View details
                      </button>
                      {canRetry && (
                        <button type="button" onClick={() => void retry(id)} disabled={Boolean(actionPending)}>
                          Retry
                        </button>
                      )}
                      {canCancel && (
                        <button type="button" onClick={() => void cancel(id)} disabled={Boolean(actionPending)}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </article>
        ))}
      </section>

      {selectedJob && (
        <section style={{ border: "1px solid #ccc", borderRadius: 8, padding: "1rem", marginTop: "2rem" }}>
          <h2>Job Detail</h2>
          <p>ID: {jobKey(selectedJob)}</p>
          <p>Type: {jobLabel(selectedJob)}</p>
          <p>Status: {String(selectedJob.status || "—")}</p>

          <h3>Payload</h3>
          <pre style={{ whiteSpace: "pre-wrap" }}>{renderJson(selectedJob.payload)}</pre>

          <h3>Output</h3>
          <pre style={{ whiteSpace: "pre-wrap" }}>{renderJson(selectedJob.output)}</pre>

          <h3>Error</h3>
          <pre style={{ whiteSpace: "pre-wrap" }}>{renderJson(selectedJob.error)}</pre>

          <h3>Logs</h3>
          {selectedLogs.length === 0 ? (
            <p>No logs returned.</p>
          ) : (
            selectedLogs.map((log, index) => (
              <pre key={`${log.jobId || "log"}-${index}`} style={{ whiteSpace: "pre-wrap" }}>
                {renderJson(log)}
              </pre>
            ))
          )}
        </section>
      )}
    </main>
  );
}
