import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { jobsApi, type JobRecord } from "../lib/jobsApi";
import { trackJobsEvent } from "../lib/analytics";

const PUBLIC_STATUSES = ["PENDING", "RUNNING", "COMPLETED", "SUCCESS", "FAILED", "DEAD", "CANCELLED"] as const;

function getJobId(job: JobRecord) {
  return job.jobId || job.id || "";
}

function getJobType(job: JobRecord) {
  return job.jobType || job.type || "unknown";
}

function getSearchText(job: JobRecord) {
  return `${getJobId(job)} ${getJobType(job)} ${job.status || ""} ${job.ownerSubsystem || ""}`.toLowerCase();
}

export function JobsPage() {
  const [status, setStatus] = useState<string>("PENDING");
  const [query, setQuery] = useState("");
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackJobsEvent("page_viewed", { path: "/jobs", surface: "marketplace" });
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    jobsApi.listJobs(status as never, 50)
      .then((result) => {
        if (!active) return;
        setJobs(result.jobs || []);
        trackJobsEvent("jobs_list_loaded", { status, count: result.jobs?.length || 0 });
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : String(err));
        trackJobsEvent("jobs_list_failed", { status, reason: "callable_error" });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [status]);

  const filteredJobs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return jobs;
    return jobs.filter((job) => getSearchText(job).includes(needle));
  }, [jobs, query]);

  return (
    <main className="page-shell">
      <section className="panel">
        <div className="eyebrow">Marketplace</div>
        <h1>Browse URAI Jobs</h1>
        <p>Search and inspect live job records from the verified URAI Jobs runtime.</p>
        <div className="filter-row">
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {PUBLIC_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Search
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Job ID, type, owner" />
          </label>
        </div>
        {loading && <p className="muted">Loading jobs...</p>}
        {error && <div className="notice error">{error}</div>}
        <div className="job-card-stack">
          {filteredJobs.map((job) => {
            const jobId = getJobId(job);
            return (
              <article className="job-card" key={jobId || JSON.stringify(job)}>
                <div className="job-card-topline">
                  <strong>{getJobType(job)}</strong>
                  <span className="status-badge">{job.status || "UNKNOWN"}</span>
                </div>
                <dl className="job-meta">
                  <div><dt>Job ID</dt><dd>{jobId || "Unknown"}</dd></div>
                  <div><dt>Owner</dt><dd>{job.ownerSubsystem || job.ownerUid || "Unknown"}</dd></div>
                </dl>
                {jobId && <Link className="secondary-button" to={`/jobs/${jobId}`}>Open job</Link>}
              </article>
            );
          })}
          {!loading && filteredJobs.length === 0 && <div className="empty-state">No jobs matched this view.</div>}
        </div>
      </section>
    </main>
  );
}

export function JobDetailPage({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackJobsEvent("job_detail_viewed", { job_id_present: Boolean(jobId) });
    jobsApi.getJob(jobId)
      .then((result) => setJob(result.job))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [jobId]);

  return (
    <main className="page-shell">
      <section className="panel">
        <div className="eyebrow">Job Detail</div>
        <h1>{jobId}</h1>
        {error && <div className="notice error">{error}</div>}
        {job ? (
          <div className="detail-grid">
            <article className="feature-item"><h3>Status</h3><p>{job.status || "Unknown"}</p></article>
            <article className="feature-item"><h3>Type</h3><p>{getJobType(job)}</p></article>
            <article className="feature-item"><h3>Owner</h3><p>{job.ownerSubsystem || job.ownerUid || "Unknown"}</p></article>
            <article className="feature-item"><h3>Payload</h3><pre className="compact-pre">{JSON.stringify(job.payload || {}, null, 2)}</pre></article>
          </div>
        ) : !error ? <p className="muted">Loading job...</p> : null}
      </section>
    </main>
  );
}

export function ApplyPage({ jobId }: { jobId: string }) {
  useEffect(() => {
    trackJobsEvent("apply_viewed", { job_id_present: Boolean(jobId) });
  }, [jobId]);

  return (
    <main className="page-shell">
      <section className="panel">
        <div className="eyebrow">Apply</div>
        <h1>Candidate application</h1>
        <p>
          Applications for job <strong>{jobId}</strong> will collect candidate profile, resume, consent, and contact details.
          This route is scaffolded for the public marketplace workflow and should be connected to the signed upload and
          application callable before public launch.
        </p>
        <div className="notice">Candidate consent, resume upload, and application submission remain tracked in Issue #33 and #34.</div>
      </section>
    </main>
  );
}

export function CandidateProfilePage() {
  useEffect(() => {
    trackJobsEvent("candidate_profile_viewed", { surface: "marketplace" });
  }, []);

  return (
    <main className="page-shell">
      <section className="panel">
        <div className="eyebrow">Candidate</div>
        <h1>Candidate profile</h1>
        <p>Profile management, resume upload, saved jobs, and application history will live here.</p>
        <div className="features-grid">
          <article className="feature-item"><h3>Profile</h3><p>Headline, location, portfolio, and skill signals.</p></article>
          <article className="feature-item"><h3>Resume</h3><p>Signed upload flow and private artifact storage.</p></article>
          <article className="feature-item"><h3>Applications</h3><p>Status history and employer responses.</p></article>
        </div>
      </section>
    </main>
  );
}

export function EmployersPage() {
  useEffect(() => {
    trackJobsEvent("employers_viewed", { surface: "marketplace" });
  }, []);

  return (
    <main className="page-shell">
      <section className="panel">
        <div className="eyebrow">Employers</div>
        <h1>Employer workspace</h1>
        <p>Employer onboarding, job posting, applicant review, and billing/plan controls will live here.</p>
        <div className="features-grid">
          <article className="feature-item"><h3>Onboarding</h3><p>Company profile, member access, and verification status.</p></article>
          <article className="feature-item"><h3>Job posts</h3><p>Create, submit for review, pause, close, and feature roles.</p></article>
          <article className="feature-item"><h3>Applicants</h3><p>Review candidates, update statuses, and preserve audit history.</p></article>
        </div>
      </section>
    </main>
  );
}

export function PricingPage() {
  useEffect(() => {
    trackJobsEvent("pricing_viewed", { surface: "marketplace" });
  }, []);

  return (
    <main className="page-shell">
      <section className="panel">
        <div className="eyebrow">Pricing</div>
        <h1>Simple launch pricing</h1>
        <div className="features-grid">
          <article className="feature-item"><h3>Launch</h3><p>Free early access while URAI Jobs validates marketplace workflows.</p></article>
          <article className="feature-item"><h3>Employer Pro</h3><p>Featured listings, applicant management, and analytics after launch.</p></article>
          <article className="feature-item"><h3>Enterprise</h3><p>Custom integrations for URAI Labs ecosystem partners.</p></article>
        </div>
      </section>
    </main>
  );
}
