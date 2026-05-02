import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { createJob } from "../lib/jobsApi";
const DEFAULT_PAYLOAD = JSON.stringify({
    text: "URAI Jobs production smoke test",
    voice: "en-US-Wavenet-D",
    locale: "en-US",
    format: "mp3",
    outputPrefix: "prod-smoke-test"
}, null, 2);
export function CreateJobPage() {
    const [jobType, setJobType] = useState("narrator.tts");
    const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
    const [status, setStatus] = useState("idle");
    const [message, setMessage] = useState("");
    async function submit(event) {
        event.preventDefault();
        setStatus("loading");
        setMessage("");
        try {
            const parsed = JSON.parse(payload);
            const result = await createJob(jobType, parsed);
            setStatus("success");
            setMessage(`Job created: ${result.jobId || result.id || "created"}`);
        }
        catch (error) {
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Create job failed.");
        }
    }
    return (_jsx("main", { className: "page-shell", children: _jsxs("section", { className: "panel", children: [_jsx("div", { className: "eyebrow", children: "Create Job" }), _jsx("h1", { children: "Submit a production job" }), _jsxs("p", { children: ["This calls the live Firebase callable function ", _jsx("code", { children: "createJob" }), "."] }), _jsxs("form", { onSubmit: submit, className: "form-stack", children: [_jsxs("label", { children: ["Job Type", _jsx("input", { value: jobType, onChange: (event) => setJobType(event.target.value) })] }), _jsxs("label", { children: ["Payload JSON", _jsx("textarea", { rows: 14, value: payload, onChange: (event) => setPayload(event.target.value) })] }), _jsx("button", { type: "submit", disabled: status === "loading", children: status === "loading" ? "Creating..." : "Create Job" })] }), status !== "idle" && (_jsxs("div", { className: `notice ${status}`, children: [_jsx("strong", { children: status.toUpperCase() }), _jsx("p", { children: message })] }))] }) }));
}
