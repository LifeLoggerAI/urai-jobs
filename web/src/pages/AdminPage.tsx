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

function ownerLabel(job: JobRecord): string {
  return String(job.ownerSubsystem || job.ownerUid || job.createdBy || "—");
}

function statusLabel(status: JobStatus): string {
  return status.replace(/_/g, " ");
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
    <main className="page-shell admin-shell">
      <header className="admin-header">
        <div>
          <div className="eyebrow">Operator Console</div>
          <h1>URAI Jobs Admin</h1>
          <p>
            Monitor live queue state, inspect payloads and logs, retry failed work,
            and cancel active jobs from one production dashboard.
          </p>
        </div>

        <div className="admin-header-actions">
          <div className="metric-card">
            <strong>{totalJobs}</strong>
            <span>Jobs loaded</span>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </header>

      {error && (
        <section className="notice error">
          <strong>Error</strong>
          <p>{error}</p>
        </section>
      )}

      {notice && (
        <section className="notice success">
          <strong>Success</strong>
          <p>{notice}</p>
        </section>
      )}

      {loading && <p className="muted">Loading live job data...</p>}
      {!loading && totalJobs === 0 && (
        <section className="empty-state">
          <div className="eyebrow">No jobs yet</div>
          <h2>The queue is clear.</h2>
          <p>Create a smoke job to verify production job creation and admin visibility.</p>
          <a className="secondary-button" href="/create">Create job</a>
        </section>
      )}

      <section className="job-board">
        {STATUSES.map((status) => (
          <article className="status-column" key={status}>
            <header className="status-column-header">
              <span className={`status-badge status-${status.replace(/_/g, "-")}`}>
                {statusLabel(status)}
              </span>
              <strong>{jobsByStatus[status].length}</strong>
            </header>

            {jobsByStatus[status].length === 0 ? (
              <p className="muted">No {statusLabel(status)} jobs.</p>
            ) : (
              <div className="job-card-stack">
                {jobsByStatus[status].map((job) => {
                  const id = jobKey(job);
                  const canRetry = status === "failed" || status === "retry_needed";
                  const canCancel = status === "queued" || status === "running";

                  return (
                    <article className="job-card" key={id}>
                      <div className="job-card-topline">
                        <strong>{jobLabel(job)}</strong>
                        <span>{job.attempts ?? 0}{job.maxAttempts !== undefined ? `/${job.maxAttempts}` : ""} attempts</span>
                      </div>

                      <dl className="job-meta">
                        <div>
                          <dt>ID</dt>
                          <dd>{id}</dd>
                        </div>
                        <div>
                          <dt>Owner</dt>
                          <dd>{ownerLabel(job)}</dd>
                        </div>
                      </dl>

                      {job.error !== undefined && (
                        <pre className="compact-pre">{renderJson(job.error)}</pre>
                      )}

                      <div className="job-actions">
                        <button type="button" onClick={() => void openJob(job)} disabled={Boolean(actionPending)}>
                          Details
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
                    </article>
                  );
                })}
              </div>
            )}
          </article>
        ))}
      </section>

      {selectedJob && (
        <section className="detail-panel">
          <header className="detail-header">
            <div>
              <div className="eyebrow">Job Detail</div>
              <h2>{jobLabel(selectedJob)}</h2>
              <p>{jobKey(selectedJob)}</p>
            </div>
            <span className={`status-badge status-${String(selectedJob.status || "unknown").replace(/_/g, "-")}`}>
              {String(selectedJob.status || "unknown").replace(/_/g, " ")}
            </span>
          </header>

          <div className="detail-grid">
            <article>
              <h3>Payload</h3>
              <pre>{renderJson(selectedJob.payload)}</pre>
            </article>
            <article>
              <h3>Output</h3>
              <pre>{renderJson(selectedJob.output)}</pre>
            </article>
            <article>
              <h3>Error</h3>
              <pre>{renderJson(selectedJob.error)}</pre>
            </article>
            <article>
              <h3>Logs</h3>
              {selectedLogs.length === 0 ? (
                <p className="muted">No logs returned.</p>
              ) : (
                selectedLogs.map((log, index) => (
                  <pre key={`${log.jobId || "log"}-${index}`}>{renderJson(log)}</pre>
                ))
              )}
            </article>
          </div>
        </section>
      )}
    </main>
  );
}
