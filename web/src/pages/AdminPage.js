import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { cancelJob, getJob, listJobLogs, listJobs, retryJob } from "../lib/jobsApi";
const STATUSES = ["queued", "running", "succeeded", "failed", "retry_needed", "cancelled"];
const emptyJobsByStatus = () => ({
    queued: [],
    running: [],
    succeeded: [],
    failed: [],
    retry_needed: [],
    cancelled: []
});
function jobKey(job) {
    return String(job.id || job.jobId || "unknown-job");
}
function jobLabel(job) {
    return String(job.jobType || job.type || "unknown");
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
    return (_jsxs("main", { style: { maxWidth: 1180, margin: "0 auto", padding: "2rem" }, children: [_jsxs("header", { style: { display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }, children: [_jsxs("div", { children: [_jsx("h1", { children: "URAI Jobs Admin" }), _jsx("p", { children: "Live Firebase-backed operator dashboard for queue, execution, retry, cancel, payload, output, and logs." })] }), _jsx("button", { type: "button", onClick: () => void refresh(), disabled: loading, children: loading ? "Loading..." : "Refresh" })] }), error && (_jsxs("section", { style: { border: "1px solid #b91c1c", padding: "1rem", margin: "1rem 0" }, children: [_jsx("strong", { children: "Error" }), _jsx("p", { children: error })] })), notice && (_jsxs("section", { style: { border: "1px solid #15803d", padding: "1rem", margin: "1rem 0" }, children: [_jsx("strong", { children: "Success" }), _jsx("p", { children: notice })] })), loading && _jsx("p", { children: "Loading live job data..." }), !loading && totalJobs === 0 && _jsx("p", { children: "No jobs returned by the backend yet." }), _jsx("section", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }, children: STATUSES.map((status) => (_jsxs("article", { style: { border: "1px solid #ccc", borderRadius: 8, padding: "1rem" }, children: [_jsxs("h2", { style: { textTransform: "capitalize" }, children: [status.replace("_", " "), " (", jobsByStatus[status].length, ")"] }), jobsByStatus[status].length === 0 ? (_jsxs("p", { children: ["No ", status.replace("_", " "), " jobs."] })) : (jobsByStatus[status].map((job) => {
                            const id = jobKey(job);
                            const canRetry = status === "failed" || status === "retry_needed";
                            const canCancel = status === "queued" || status === "running";
                            return (_jsxs("div", { style: { borderTop: "1px solid #ddd", paddingTop: "0.75rem", marginTop: "0.75rem" }, children: [_jsx("strong", { children: jobLabel(job) }), _jsxs("p", { children: ["ID: ", id] }), _jsxs("p", { children: ["Owner: ", String(job.ownerSubsystem || job.ownerUid || job.createdBy || "—")] }), _jsxs("p", { children: ["Attempts: ", job.attempts ?? 0, job.maxAttempts !== undefined ? ` / ${job.maxAttempts}` : ""] }), job.error !== undefined && _jsx("pre", { children: renderJson(job.error) }), _jsxs("div", { style: { display: "flex", gap: "0.5rem", flexWrap: "wrap" }, children: [_jsx("button", { type: "button", onClick: () => void openJob(job), disabled: Boolean(actionPending), children: "View details" }), canRetry && (_jsx("button", { type: "button", onClick: () => void retry(id), disabled: Boolean(actionPending), children: "Retry" })), canCancel && (_jsx("button", { type: "button", onClick: () => void cancel(id), disabled: Boolean(actionPending), children: "Cancel" }))] })] }, id));
                        }))] }, status))) }), selectedJob && (_jsxs("section", { style: { border: "1px solid #ccc", borderRadius: 8, padding: "1rem", marginTop: "2rem" }, children: [_jsx("h2", { children: "Job Detail" }), _jsxs("p", { children: ["ID: ", jobKey(selectedJob)] }), _jsxs("p", { children: ["Type: ", jobLabel(selectedJob)] }), _jsxs("p", { children: ["Status: ", String(selectedJob.status || "—")] }), _jsx("h3", { children: "Payload" }), _jsx("pre", { style: { whiteSpace: "pre-wrap" }, children: renderJson(selectedJob.payload) }), _jsx("h3", { children: "Output" }), _jsx("pre", { style: { whiteSpace: "pre-wrap" }, children: renderJson(selectedJob.output) }), _jsx("h3", { children: "Error" }), _jsx("pre", { style: { whiteSpace: "pre-wrap" }, children: renderJson(selectedJob.error) }), _jsx("h3", { children: "Logs" }), selectedLogs.length === 0 ? (_jsx("p", { children: "No logs returned." })) : (selectedLogs.map((log, index) => (_jsx("pre", { style: { whiteSpace: "pre-wrap" }, children: renderJson(log) }, `${log.jobId || "log"}-${index}`))))] }))] }));
}
