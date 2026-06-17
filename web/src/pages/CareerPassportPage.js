import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { createJob } from "../lib/jobsApi";
import { buildPassportExportPayload, careerPassportSeed } from "../lib/careerPassport";
const idleRuntimeJob = { status: "idle", message: "" };
export function CareerPassportPage() {
    const [state, setState] = useState(careerPassportSeed);
    const [passportJob, setPassportJob] = useState(idleRuntimeJob);
    const exportPayload = useMemo(() => buildPassportExportPayload(state), [state]);
    function setMode(mode) {
        setState((current) => ({ ...current, activeMode: mode }));
    }
    async function runPassportExport() {
        setPassportJob({ status: "loading", message: "Creating career.passport.export job..." });
        try {
            const result = await createJob("career.passport.export", {
                source: "career-passport-v5",
                passport: state,
                exportPayload,
                outputPrefix: `career-passport/export/${state.activeMode}`
            });
            const jobId = String(result.jobId || result.id || "created");
            setPassportJob({ status: "success", jobId, message: `Passport export job created: ${jobId}` });
        }
        catch (error) {
            setPassportJob({ status: "error", message: error instanceof Error ? error.message : "Passport export job failed." });
        }
    }
    return (_jsxs("main", { className: "page-shell career-passport-shell", children: [_jsxs("section", { className: "hero career-mirror-hero", children: [_jsx("div", { className: "eyebrow", children: "Career Passport V5" }), _jsx("h1", { children: "Economic path graph and revocable profile packets." }), _jsx("p", { children: "V5 expands URAI-Jobs into a user-controlled career identity and economic path system. Passport packets remain private or review-scoped and can be exported through the approved runtime job." }), _jsxs("div", { className: "hero-actions", children: [_jsx("button", { type: "button", onClick: () => void runPassportExport(), disabled: passportJob.status === "loading", children: passportJob.status === "loading" ? "Creating export job..." : "Export Passport packet" }), _jsx("a", { className: "secondary-button", href: "/career-decision", children: "Open Decision V4" }), _jsx("a", { className: "secondary-button", href: "/career-versions", children: "View version console" })] }), passportJob.status !== "idle" && (_jsxs("div", { className: `notice ${passportJob.status}`, children: [_jsx("strong", { children: passportJob.status.toUpperCase() }), _jsx("p", { children: passportJob.message }), passportJob.jobId && _jsx("a", { className: "secondary-button", href: "/admin", children: "View in admin" })] }))] }), _jsxs("section", { className: "section-block", children: [_jsxs("div", { className: "section-heading", children: [_jsx("div", { className: "eyebrow", children: "Mode" }), _jsx("h2", { children: "Choose the economic lens." }), _jsxs("p", { children: ["Active mode: ", state.activeMode] })] }), _jsx("div", { className: "hero-actions compact", children: ["founder", "freelancer", "employee", "student", "rebuild"].map((mode) => (_jsx("button", { type: "button", className: state.activeMode === mode ? "preset-card active" : "secondary-button", onClick: () => setMode(mode), children: mode }, mode))) })] }), _jsxs("section", { className: "section-block", children: [_jsxs("div", { className: "section-heading", children: [_jsx("div", { className: "eyebrow", children: "Passport packets" }), _jsx("h2", { children: "User-controlled career identity." })] }), _jsx("div", { className: "features-grid", children: state.packets.map((packet) => (_jsxs("article", { className: "feature-item", children: [_jsxs("div", { className: "launch-stage-header", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: packet.visibility }), _jsx("h3", { children: packet.label })] }), _jsx("span", { className: "launch-status", children: packet.mode })] }), _jsxs("p", { children: ["Strengths: ", packet.strengths.join(", ")] }), _jsxs("p", { children: ["Preferences: ", packet.workPreferences.join(", ")] }), _jsx("ul", { className: "check-list", children: packet.consentNotes.map((note) => _jsx("li", { children: note }, note)) })] }, packet.id))) })] }), _jsxs("section", { className: "section-block", children: [_jsxs("div", { className: "section-heading", children: [_jsx("div", { className: "eyebrow", children: "Economic path graph" }), _jsx("h2", { children: "Multiple path categories, one user-owned map." })] }), _jsx("div", { className: "features-grid", children: state.pathNodes.map((node) => (_jsxs("article", { className: "feature-item", children: [_jsxs("div", { className: "eyebrow", children: [node.stage, " \u00B7 ", node.category] }), _jsx("h3", { children: node.label }), _jsxs("p", { children: ["Fit: ", node.fit] }), _jsx("ul", { className: "check-list", children: node.notes.map((note) => _jsx("li", { children: note }, note)) })] }, node.id))) })] }), _jsxs("section", { className: "section-block", children: [_jsxs("div", { className: "section-heading", children: [_jsx("div", { className: "eyebrow", children: "Skill gaps" }), _jsx("h2", { children: "Turn missing skills into suggested projects." })] }), _jsx("div", { className: "features-grid", children: state.skillGaps.map((gap) => (_jsxs("article", { className: "feature-item", children: [_jsx("div", { className: "eyebrow", children: gap.priority }), _jsx("h3", { children: gap.skill }), _jsx("p", { children: gap.suggestedProject })] }, gap.id))) })] })] }));
}
