import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { cancelJob, getJob, listJobLogs, listJobs, retryJob } from "../lib/jobsApi";
const STATUS_COLUMNS = [
    { value: "PENDING", label: "Queued", className: "queued" },
    { value: "LEASED", label: "Leased", className: "leased" },
    { value: "RUNNING", label: "Running", className: "running" },
    { value: "SUCCESS", label: "Succeeded", className: "succeeded" },
    { value: "FAILED", label: "Failed", className: "failed" },
    { value: "DEAD", label: "Dead", className: "dead" },
    { value: "CANCELLED", label: "Cancelled", className: "cancelled" }
];
const STATUSES = STATUS_COLUMNS.map((column) => column.value);
const emptyJobsByStatus = () => ({
    PENDING: [],
    LEASED: [],
    RUNNING: [],
    SUCCESS: [],
    FAILED: [],
    DEAD: [],
    CANCELLED: []
});
function jobKey(job) {
    return String(job.id || job.jobId || "unknown-job");
}
function jobLabel(job) {
    return String(job.jobType || job.type || "unknown");
}
function ownerLabel(job) {
    return String(job.ownerSubsystem || job.ownerUid || job.createdBy || "—");
}
function statusDisplay(status) {
    return STATUS_COLUMNS.find((column) => column.value === status) ?? {
        value: status || "UNKNOWN",
        label: status || "Unknown",
        className: "unknown"
    };
}
function renderJson(value) {
    if (value === undefined || value === null || value === "")
        return "—";
    try {
        return JSON.stringify(value, null, 2);
    }
    catch {
        return String(value);
    }
}
export function AdminPage() {
    const [jobsByStatus, setJobsByStatus] = useState(emptyJobsByStatus);
    const [selectedJob, setSelectedJob] = useState(null);
    const [selectedLogs, setSelectedLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionPending, setActionPending] = useState(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const totalJobs = useMemo(() => STATUSES.reduce((sum, status) => sum + jobsByStatus[status].length, 0), [jobsByStatus]);
    async function refresh() {
        setLoading(true);
        setError("");
        try {
            const entries = await Promise.all(STATUSES.map(async (status) => {
                const result = await listJobs(status);
                return [status, result.jobs || []];
            }));
            const next = emptyJobsByStatus();
            for (const [status, jobs] of entries)
                next[status] = jobs;
            setJobsByStatus(next);
        }
        catch (refreshError) {
            setError(refreshError instanceof Error ? refreshError.message : "Failed to load jobs.");
        }
        finally {
            setLoading(false);
        }
    }
    async function openJob(job) {
        const id = jobKey(job);
        setActionPending(`view:${id}`);
        setError("");
        setNotice("");
        try {
            const detail = await getJob(id);
            const logs = await listJobLogs(id);
            setSelectedJob(detail.job || job);
            setSelectedLogs(logs.logs || detail.logs || []);
        }
        catch (detailError) {
            setError(detailError instanceof Error ? detailError.message : "Failed to load job detail.");
        }
        finally {
            setActionPending(null);
        }
    }
    async function retry(id) {
        setActionPending(`retry:${id}`);
        setError("");
        setNotice("");
        try {
            await retryJob(id);
            setNotice(`Retry queued for ${id}.`);
            await refresh();
        }
        catch (retryError) {
            setError(retryError instanceof Error ? retryError.message : "Retry failed.");
        }
        finally {
            setActionPending(null);
        }
    }
    async function cancel(id) {
        setActionPending(`cancel:${id}`);
        setError("");
        setNotice("");
        try {
            await cancelJob(id);
            setNotice(`Cancelled ${id}.`);
            await refresh();
        }
        catch (cancelError) {
            setError(cancelError instanceof Error ? cancelError.message : "Cancel failed.");
        }
        finally {
            setActionPending(null);
        }
    }
    useEffect(() => {
        void refresh();
    }, []);
    return (_jsxs("main", { className: "page-shell admin-shell", children: [_jsxs("header", { className: "admin-header", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: "Operator Console" }), _jsx("h1", { children: "URAI Jobs Admin" }), _jsx("p", { children: "Monitor live queue state, inspect payloads and logs, retry failed work, and cancel active jobs from one production dashboard." })] }), _jsxs("div", { className: "admin-header-actions", children: [_jsxs("div", { className: "metric-card", children: [_jsx("strong", { children: totalJobs }), _jsx("span", { children: "Jobs loaded" })] }), _jsx("button", { type: "button", onClick: () => void refresh(), disabled: loading, children: loading ? "Loading..." : "Refresh" })] })] }), error && (_jsxs("section", { className: "notice error", children: [_jsx("strong", { children: "Error" }), _jsx("p", { children: error })] })), notice && (_jsxs("section", { className: "notice success", children: [_jsx("strong", { children: "Success" }), _jsx("p", { children: notice })] })), loading && _jsx("p", { className: "muted", children: "Loading live job data..." }), !loading && totalJobs === 0 && (_jsxs("section", { className: "empty-state", children: [_jsx("div", { className: "eyebrow", children: "No jobs yet" }), _jsx("h2", { children: "The queue is clear." }), _jsx("p", { children: "Create a smoke job to verify production job creation and admin visibility." }), _jsx("a", { className: "secondary-button", href: "/create", children: "Create job" })] })), _jsx("section", { className: "job-board", children: STATUS_COLUMNS.map((column) => (_jsxs("article", { className: "status-column", children: [_jsxs("header", { className: "status-column-header", children: [_jsx("span", { className: `status-badge status-${column.className}`, children: column.label }), _jsx("strong", { children: jobsByStatus[column.value].length })] }), jobsByStatus[column.value].length === 0 ? (_jsxs("p", { className: "muted", children: ["No ", column.label.toLowerCase(), " jobs."] })) : (_jsx("div", { className: "job-card-stack", children: jobsByStatus[column.value].map((job) => {
                                const id = jobKey(job);
                                const status = String(job.status || column.value);
                                const canRetry = status === "FAILED";
                                const canCancel = status === "PENDING" || status === "LEASED" || status === "RUNNING";
                                return (_jsxs("article", { className: "job-card", children: [_jsxs("div", { className: "job-card-topline", children: [_jsx("strong", { children: jobLabel(job) }), _jsxs("span", { children: [job.attempts ?? 0, job.maxAttempts !== undefined ? `/${job.maxAttempts}` : "", " attempts"] })] }), _jsxs("dl", { className: "job-meta", children: [_jsxs("div", { children: [_jsx("dt", { children: "ID" }), _jsx("dd", { children: id })] }), _jsxs("div", { children: [_jsx("dt", { children: "Owner" }), _jsx("dd", { children: ownerLabel(job) })] })] }), job.error !== undefined && (_jsx("pre", { className: "compact-pre", children: renderJson(job.error) })), _jsxs("div", { className: "job-actions", children: [_jsx("button", { type: "button", onClick: () => void openJob(job), disabled: Boolean(actionPending), children: "Details" }), canRetry && (_jsx("button", { type: "button", onClick: () => void retry(id), disabled: Boolean(actionPending), children: "Retry" })), canCancel && (_jsx("button", { type: "button", onClick: () => void cancel(id), disabled: Boolean(actionPending), children: "Cancel" }))] })] }, id));
                            }) }))] }, column.value))) }), selectedJob && (() => {
                const selectedStatus = statusDisplay(String(selectedJob.status || "UNKNOWN"));
                return (_jsxs("section", { className: "detail-panel", children: [_jsxs("header", { className: "detail-header", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: "Job Detail" }), _jsx("h2", { children: jobLabel(selectedJob) }), _jsx("p", { children: jobKey(selectedJob) })] }), _jsx("span", { className: `status-badge status-${selectedStatus.className}`, children: selectedStatus.label })] }), _jsxs("div", { className: "detail-grid", children: [_jsxs("article", { children: [_jsx("h3", { children: "Payload" }), _jsx("pre", { children: renderJson(selectedJob.payload) })] }), _jsxs("article", { children: [_jsx("h3", { children: "Output" }), _jsx("pre", { children: renderJson(selectedJob.output) })] }), _jsxs("article", { children: [_jsx("h3", { children: "Error" }), _jsx("pre", { children: renderJson(selectedJob.error) })] }), _jsxs("article", { children: [_jsx("h3", { children: "Logs" }), selectedLogs.length === 0 ? (_jsx("p", { className: "muted", children: "No logs returned." })) : (selectedLogs.map((log, index) => (_jsx("pre", { children: renderJson(log) }, `${log.jobId || "log"}-${index}`))))] })] })] }));
            })()] }));
}
