import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { createJob } from "../lib/jobsApi";
const careerProfile = {
    preferredMode: "flexible",
    autonomy: "high",
    meetingLoad: "low",
    workRhythm: "deep-work",
    growthGoal: "Find work that supports focused building, creative systems thinking, and long-term ownership.",
    avoidPatterns: ["unclear ownership", "heavy meeting load", "commission-only structure"]
};
const careerOpportunity = {
    id: "urai-career-ai-product-builder",
    title: "AI Product Builder",
    organization: "Mission-driven product team",
    mode: "flexible",
    fitScore: 94,
    stressRisk: "low",
    growthFit: "high"
};
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
    },
    "career.profile.summarize": {
        label: "Career profile summary",
        payload: {
            source: "operator-preset",
            profile: careerProfile,
            outputPrefix: "career-smoke/profile-summary"
        }
    },
    "career.fit.score": {
        label: "Career fit score",
        payload: {
            source: "operator-preset",
            profile: careerProfile,
            opportunity: careerOpportunity,
            outputPrefix: "career-smoke/fit-score"
        }
    },
    "career.document.parse": {
        label: "Career document parse",
        payload: {
            source: "operator-preset",
            documentRef: "gs://urai-jobs-sample-inputs/career/profile.md",
            outputPrefix: "career-smoke/document-parse"
        }
    },
    "career.document.tailor": {
        label: "Career document tailor",
        payload: {
            source: "operator-preset",
            profile: careerProfile,
            opportunity: careerOpportunity,
            documentRef: "gs://urai-jobs-sample-inputs/career/profile.md",
            outputPrefix: "career-smoke/document-tailor"
        }
    },
    "career.packet.generate": {
        label: "Career packet generate",
        payload: {
            source: "operator-preset",
            profile: careerProfile,
            opportunity: careerOpportunity,
            outputPrefix: "career-smoke/packet"
        }
    },
    "career.followup.plan": {
        label: "Career follow-up plan",
        payload: {
            source: "operator-preset",
            opportunity: careerOpportunity,
            cadence: "review-only",
            outputPrefix: "career-smoke/followup-plan"
        }
    },
    "career.interview.prep": {
        label: "Career interview prep",
        payload: {
            source: "operator-preset",
            profile: careerProfile,
            opportunity: careerOpportunity,
            outputPrefix: "career-smoke/interview-prep"
        }
    },
    "career.offer.compare": {
        label: "Career offer compare",
        payload: {
            source: "operator-preset",
            profile: careerProfile,
            offers: [
                { id: "offer-a", title: "AI Product Builder", compensation: "TBD", mode: "flexible" },
                { id: "offer-b", title: "Spatial Experience Lead", compensation: "TBD", mode: "hybrid" }
            ],
            outputPrefix: "career-smoke/offer-compare"
        }
    },
    "career.spatial.portal.generate": {
        label: "Career spatial portal",
        payload: {
            source: "operator-preset",
            profile: careerProfile,
            opportunity: careerOpportunity,
            outputPrefix: "career-smoke/spatial-portal"
        }
    },
    "career.passport.export": {
        label: "Career Passport export",
        payload: {
            source: "operator-preset",
            profile: careerProfile,
            consentScope: "private-preview",
            outputPrefix: "career-smoke/passport-export"
        }
    }
};
function stringify(value) {
    return JSON.stringify(value, null, 2);
}
export function CreateJobPage() {
    const [jobType, setJobType] = useState("narrator.tts");
    const [payload, setPayload] = useState(stringify(PRESETS["narrator.tts"].payload));
    const [status, setStatus] = useState("idle");
    const [message, setMessage] = useState("");
    const [createdJobId, setCreatedJobId] = useState("");
    const payloadIsValid = useMemo(() => {
        try {
            JSON.parse(payload);
            return true;
        }
        catch {
            return false;
        }
    }, [payload]);
    function selectPreset(nextType) {
        setJobType(nextType);
        setPayload(stringify(PRESETS[nextType].payload));
        setStatus("idle");
        setMessage("");
        setCreatedJobId("");
    }
    async function submit(event) {
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
        }
        catch (error) {
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Create job failed.");
        }
    }
    async function copyJobId() {
        if (!createdJobId)
            return;
        await navigator.clipboard?.writeText(createdJobId);
    }
    return (_jsx("main", { className: "page-shell", children: _jsxs("section", { className: "panel", children: [_jsx("div", { className: "eyebrow", children: "Create Job" }), _jsx("h1", { children: "Submit controlled production work." }), _jsx("p", { children: "Choose a preset, inspect the payload, then submit it to the live Firebase callable function. Use this for smoke tests, operator workflows, and subsystem integration checks." }), _jsx("div", { className: "preset-grid", children: Object.keys(PRESETS).map((key) => (_jsxs("button", { className: key === jobType ? "preset-card active" : "preset-card", type: "button", onClick: () => selectPreset(key), children: [_jsx("strong", { children: PRESETS[key].label }), _jsx("span", { children: key })] }, key))) }), _jsxs("form", { onSubmit: submit, className: "form-stack", children: [_jsxs("label", { children: ["Job Type", _jsx("input", { value: jobType, onChange: (event) => setJobType(event.target.value) })] }), _jsxs("label", { children: ["Payload JSON", _jsx("textarea", { rows: 14, value: payload, onChange: (event) => setPayload(event.target.value) })] }), _jsxs("div", { className: "form-actions", children: [_jsx("button", { type: "submit", disabled: status === "loading" || !payloadIsValid, children: status === "loading" ? "Creating..." : "Create Job" }), !payloadIsValid && _jsx("span", { className: "form-hint danger-text", children: "Payload JSON is invalid." })] })] }), status !== "idle" && (_jsxs("div", { className: `notice ${status}`, children: [_jsx("strong", { children: status === "success" ? "SUCCESS" : status.toUpperCase() }), _jsx("p", { children: message }), createdJobId && (_jsxs("div", { className: "hero-actions compact", children: [_jsx("button", { type: "button", onClick: () => void copyJobId(), children: "Copy job ID" }), _jsx("a", { className: "secondary-button", href: "/admin", children: "Open admin" })] }))] }))] }) }));
}
