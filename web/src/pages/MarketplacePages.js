import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { jobsApi } from "../lib/jobsApi";
import { trackJobsEvent } from "../lib/analytics";
import { notificationTemplates, queueNotificationDraft } from "../lib/notifications";
const PUBLIC_STATUSES = ["PENDING", "RUNNING", "COMPLETED", "SUCCESS", "FAILED", "DEAD", "CANCELLED"];
function getJobId(job) {
    return job.jobId || job.id || "";
}
function getJobType(job) {
    return job.jobType || job.type || "unknown";
}
function getSearchText(job) {
    return `${getJobId(job)} ${getJobType(job)} ${job.status || ""} ${job.ownerSubsystem || ""}`.toLowerCase();
}
export function JobsPage() {
    const [status, setStatus] = useState("PENDING");
    const [query, setQuery] = useState("");
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        trackJobsEvent("page_viewed", { path: "/jobs", surface: "marketplace" });
    }, []);
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(null);
        jobsApi.listJobs(status, 50)
            .then((result) => {
            if (!active)
                return;
            setJobs(result.jobs || []);
            trackJobsEvent("jobs_list_loaded", { status, count: result.jobs?.length || 0 });
        })
            .catch((err) => {
            if (!active)
                return;
            setError(err instanceof Error ? err.message : String(err));
            trackJobsEvent("jobs_list_failed", { status, reason: "callable_error" });
        })
            .finally(() => {
            if (active)
                setLoading(false);
        });
        return () => { active = false; };
    }, [status]);
    const filteredJobs = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle)
            return jobs;
        return jobs.filter((job) => getSearchText(job).includes(needle));
    }, [jobs, query]);
    return (_jsx("main", { className: "page-shell", children: _jsxs("section", { className: "panel", children: [_jsx("div", { className: "eyebrow", children: "Marketplace" }), _jsx("h1", { children: "Browse URAI Jobs" }), _jsx("p", { children: "Search and inspect live job records from the verified URAI Jobs runtime." }), _jsxs("div", { className: "filter-row", children: [_jsxs("label", { children: ["Status", _jsx("select", { value: status, onChange: (event) => setStatus(event.target.value), children: PUBLIC_STATUSES.map((item) => _jsx("option", { value: item, children: item }, item)) })] }), _jsxs("label", { children: ["Search", _jsx("input", { value: query, onChange: (event) => setQuery(event.target.value), placeholder: "Job ID, type, owner" })] })] }), loading && _jsx("p", { className: "muted", children: "Loading jobs..." }), error && _jsx("div", { className: "notice error", children: error }), _jsxs("div", { className: "job-card-stack", children: [filteredJobs.map((job) => {
                            const jobId = getJobId(job);
                            return (_jsxs("article", { className: "job-card", children: [_jsxs("div", { className: "job-card-topline", children: [_jsx("strong", { children: getJobType(job) }), _jsx("span", { className: "status-badge", children: job.status || "UNKNOWN" })] }), _jsxs("dl", { className: "job-meta", children: [_jsxs("div", { children: [_jsx("dt", { children: "Job ID" }), _jsx("dd", { children: jobId || "Unknown" })] }), _jsxs("div", { children: [_jsx("dt", { children: "Owner" }), _jsx("dd", { children: job.ownerSubsystem || job.ownerUid || "Unknown" })] })] }), jobId && _jsx(Link, { className: "secondary-button", to: `/jobs/${jobId}`, children: "Open job" })] }, jobId || JSON.stringify(job)));
                        }), !loading && filteredJobs.length === 0 && _jsx("div", { className: "empty-state", children: "No jobs matched this view." })] })] }) }));
}
export function JobDetailPage({ jobId }) {
    const [job, setJob] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        trackJobsEvent("job_detail_viewed", { job_id_present: Boolean(jobId) });
        jobsApi.getJob(jobId)
            .then((result) => setJob(result.job))
            .catch((err) => setError(err instanceof Error ? err.message : String(err)));
    }, [jobId]);
    return (_jsx("main", { className: "page-shell", children: _jsxs("section", { className: "panel", children: [_jsx("div", { className: "eyebrow", children: "Job Detail" }), _jsx("h1", { children: jobId }), error && _jsx("div", { className: "notice error", children: error }), job ? (_jsxs("div", { className: "detail-grid", children: [_jsxs("article", { className: "feature-item", children: [_jsx("h3", { children: "Status" }), _jsx("p", { children: job.status || "Unknown" })] }), _jsxs("article", { className: "feature-item", children: [_jsx("h3", { children: "Type" }), _jsx("p", { children: getJobType(job) })] }), _jsxs("article", { className: "feature-item", children: [_jsx("h3", { children: "Owner" }), _jsx("p", { children: job.ownerSubsystem || job.ownerUid || "Unknown" })] }), _jsxs("article", { className: "feature-item", children: [_jsx("h3", { children: "Payload" }), _jsx("pre", { className: "compact-pre", children: JSON.stringify(job.payload || {}, null, 2) })] })] })) : !error ? _jsx("p", { className: "muted", children: "Loading job..." }) : null] }) }));
}
export function ApplyPage({ jobId }) {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        trackJobsEvent("apply_viewed", { job_id_present: Boolean(jobId) });
    }, [jobId]);
    function submitApplication(event) {
        event.preventDefault();
        setSubmitted(true);
        trackJobsEvent("application_submitted", { job_id_present: Boolean(jobId), consent_checked: true });
        queueNotificationDraft(notificationTemplates.applicationSubmitted(jobId));
    }
    return (_jsx("main", { className: "page-shell", children: _jsxs("section", { className: "panel", children: [_jsx("div", { className: "eyebrow", children: "Apply" }), _jsx("h1", { children: "Candidate application" }), _jsxs("p", { children: ["Applications for job ", _jsx("strong", { children: jobId }), " collect candidate details, resume references, and consent. This launch scaffold records client-side analytics and notification drafts until the application callable is connected."] }), _jsxs("form", { className: "form-stack", onSubmit: submitApplication, children: [_jsxs("label", { children: ["Full name", _jsx("input", { required: true, placeholder: "Candidate name" })] }), _jsxs("label", { children: ["Email", _jsx("input", { required: true, type: "email", placeholder: "candidate@example.com" })] }), _jsxs("label", { children: ["Resume link", _jsx("input", { placeholder: "Private resume or portfolio link" })] }), _jsxs("label", { children: ["Why this role?", _jsx("textarea", { rows: 4, placeholder: "Brief candidate note" })] }), _jsxs("label", { className: "checkbox-row", children: [_jsx("input", { required: true, type: "checkbox" }), " I consent to URAI Jobs processing this application and related profile data."] }), _jsx("button", { type: "submit", children: "Submit application draft" })] }), submitted && _jsx("div", { className: "notice success", children: "Application draft captured. Notification draft queued for delivery integration." })] }) }));
}
export function CandidateProfilePage() {
    const [saved, setSaved] = useState(false);
    useEffect(() => {
        trackJobsEvent("candidate_profile_viewed", { surface: "marketplace" });
    }, []);
    function saveProfile(event) {
        event.preventDefault();
        setSaved(true);
        trackJobsEvent("candidate_profile_saved", { has_resume_link: true });
    }
    return (_jsx("main", { className: "page-shell", children: _jsxs("section", { className: "panel", children: [_jsx("div", { className: "eyebrow", children: "Candidate" }), _jsx("h1", { children: "Candidate profile" }), _jsx("p", { children: "Profile management, resume upload, saved jobs, and application history will live here." }), _jsxs("form", { className: "form-stack", onSubmit: saveProfile, children: [_jsxs("label", { children: ["Headline", _jsx("input", { placeholder: "AI operations specialist" })] }), _jsxs("label", { children: ["Location", _jsx("input", { placeholder: "Remote / city" })] }), _jsxs("label", { children: ["Skills", _jsx("input", { placeholder: "Firebase, React, Cloud Run" })] }), _jsxs("label", { children: ["Resume URL", _jsx("input", { placeholder: "Private signed-upload URL placeholder" })] }), _jsx("button", { type: "submit", children: "Save profile draft" })] }), saved && _jsx("div", { className: "notice success", children: "Candidate profile draft saved locally for launch workflow validation." })] }) }));
}
export function EmployersPage() {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        trackJobsEvent("employers_viewed", { surface: "marketplace" });
    }, []);
    function submitJobPost(event) {
        event.preventDefault();
        setSubmitted(true);
        trackJobsEvent("job_post_submitted", { consent_checked: true });
        queueNotificationDraft(notificationTemplates.jobPostSubmitted());
    }
    return (_jsx("main", { className: "page-shell", children: _jsxs("section", { className: "panel", children: [_jsx("div", { className: "eyebrow", children: "Employers" }), _jsx("h1", { children: "Employer workspace" }), _jsx("p", { children: "Employer onboarding, job posting, applicant review, and billing/plan controls will live here." }), _jsxs("form", { className: "form-stack", onSubmit: submitJobPost, children: [_jsxs("label", { children: ["Company name", _jsx("input", { required: true, placeholder: "URAI Labs partner" })] }), _jsxs("label", { children: ["Role title", _jsx("input", { required: true, placeholder: "AI systems engineer" })] }), _jsxs("label", { children: ["Role summary", _jsx("textarea", { required: true, rows: 4, placeholder: "What should candidates know?" })] }), _jsxs("label", { className: "checkbox-row", children: [_jsx("input", { required: true, type: "checkbox" }), " I agree to submit truthful role information for moderation."] }), _jsx("button", { type: "submit", children: "Submit job post draft" })] }), submitted && _jsx("div", { className: "notice success", children: "Employer job post draft queued for moderation workflow integration." })] }) }));
}
export function PricingPage() {
    useEffect(() => {
        trackJobsEvent("pricing_viewed", { surface: "marketplace" });
    }, []);
    return (_jsx("main", { className: "page-shell", children: _jsxs("section", { className: "panel", children: [_jsx("div", { className: "eyebrow", children: "Pricing" }), _jsx("h1", { children: "Simple launch pricing" }), _jsxs("div", { className: "features-grid", children: [_jsxs("article", { className: "feature-item", children: [_jsx("h3", { children: "Launch" }), _jsx("p", { children: "Free early access while URAI Jobs validates marketplace workflows." })] }), _jsxs("article", { className: "feature-item", children: [_jsx("h3", { children: "Employer Pro" }), _jsx("p", { children: "Featured listings, applicant management, and analytics after launch." })] }), _jsxs("article", { className: "feature-item", children: [_jsx("h3", { children: "Enterprise" }), _jsx("p", { children: "Custom integrations for URAI Labs ecosystem partners." })] })] })] }) }));
}
