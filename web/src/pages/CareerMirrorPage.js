import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { createJob } from "../lib/jobsApi";
import { explainFit } from "../lib/careerMirror";
import { loadCareerMirrorState, resetCareerMirrorState, saveCareerMirrorState } from "../lib/careerMirrorStore";
const idleRuntimeJob = { status: "idle", message: "" };
export function CareerMirrorPage() {
    const [mirrorState, setMirrorState] = useState(() => loadCareerMirrorState());
    const [profileJob, setProfileJob] = useState(idleRuntimeJob);
    const [fitJob, setFitJob] = useState(idleRuntimeJob);
    const profile = mirrorState.profile;
    const opportunities = mirrorState.opportunities;
    const selectedId = mirrorState.selectedId;
    const visibleOpportunities = useMemo(() => opportunities.filter((item) => !item.hidden), [opportunities]);
    const selected = visibleOpportunities.find((item) => item.id === selectedId) ?? visibleOpportunities[0];
    function persist(update) {
        setMirrorState((current) => saveCareerMirrorState({ ...current, ...update }));
    }
    function updateProfile(update) {
        persist({ profile: { ...profile, ...update } });
    }
    function updateOpportunity(id, update) {
        persist({ opportunities: opportunities.map((item) => (item.id === id ? { ...item, ...update } : item)) });
    }
    function selectOpportunity(id) {
        persist({ selectedId: id });
    }
    function hideOpportunity(id) {
        const nextOpportunities = opportunities.map((item) => (item.id === id ? { ...item, hidden: true } : item));
        const nextVisible = nextOpportunities.filter((item) => !item.hidden);
        persist({ opportunities: nextOpportunities, selectedId: nextVisible[0]?.id ?? "" });
    }
    function resetMirror() {
        setMirrorState(resetCareerMirrorState());
        setProfileJob(idleRuntimeJob);
        setFitJob(idleRuntimeJob);
    }
    async function runProfileSummary() {
        setProfileJob({ status: "loading", message: "Creating career.profile.summarize job..." });
        try {
            const result = await createJob("career.profile.summarize", {
                profile,
                source: "career-mirror-v1",
                outputPrefix: "career-mirror/profile-summary"
            });
            const jobId = String(result.jobId || result.id || "created");
            setProfileJob({ status: "success", jobId, message: `Profile summary job created: ${jobId}` });
        }
        catch (error) {
            setProfileJob({ status: "error", message: error instanceof Error ? error.message : "Profile summary job failed." });
        }
    }
    async function runFitScore() {
        if (!selected)
            return;
        setFitJob({ status: "loading", message: "Creating career.fit.score job..." });
        try {
            const result = await createJob("career.fit.score", {
                profile,
                opportunity: selected,
                source: "career-mirror-v1",
                outputPrefix: `career-mirror/fit-score/${selected.id}`
            });
            const jobId = String(result.jobId || result.id || "created");
            setFitJob({ status: "success", jobId, message: `Fit score job created: ${jobId}` });
        }
        catch (error) {
            setFitJob({ status: "error", message: error instanceof Error ? error.message : "Fit score job failed." });
        }
    }
    return (_jsxs("main", { className: "page-shell career-mirror-shell", children: [_jsxs("section", { className: "hero hero-grid career-mirror-hero", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: "Career Mirror V1" }), _jsx("h1", { children: "Find work that fits how you actually operate." }), _jsx("p", { children: "This V1 scaffold keeps the public Career Mirror separate from the internal runtime UI. It shows work preferences, opportunity fit, save/hide controls, and explainable match reasoning without sending external applications." }), _jsxs("div", { className: "hero-actions", children: [_jsx("a", { className: "cta-button", href: "#opportunities", children: "Review opportunities" }), _jsx("button", { type: "button", className: "secondary-button", onClick: () => void runProfileSummary(), disabled: profileJob.status === "loading", children: profileJob.status === "loading" ? "Creating profile job..." : "Summarize profile" }), _jsx("button", { type: "button", className: "secondary-button", onClick: resetMirror, children: "Reset V1 state" })] }), profileJob.status !== "idle" && (_jsxs("div", { className: `notice ${profileJob.status}`, children: [_jsx("strong", { children: profileJob.status.toUpperCase() }), _jsx("p", { children: profileJob.message }), profileJob.jobId && _jsx("a", { className: "secondary-button", href: "/admin", children: "View in admin" })] }))] }), _jsxs("aside", { className: "hero-card", children: [_jsx("div", { className: "eyebrow", children: "Work Preference Profile" }), _jsxs("ul", { className: "check-list", children: [_jsxs("li", { children: ["Mode: ", profile.preferredMode] }), _jsxs("li", { children: ["Autonomy: ", profile.autonomy] }), _jsxs("li", { children: ["Meeting load: ", profile.meetingLoad] }), _jsxs("li", { children: ["Rhythm: ", profile.workRhythm] }), _jsxs("li", { children: ["Saved locally: ", new Date(mirrorState.updatedAt).toLocaleString()] })] })] })] }), _jsxs("section", { className: "section-block", children: [_jsxs("div", { className: "section-heading", children: [_jsx("div", { className: "eyebrow", children: "V1 profile controls" }), _jsx("h2", { children: "Editable work rhythm, persisted locally." }), _jsx("p", { children: "These controls establish the V1 data model before replacing local persistence with authenticated, user-scoped storage." })] }), _jsxs("div", { className: "features-grid career-profile-grid", children: [_jsxs("label", { className: "feature-item", children: ["Preferred mode", _jsxs("select", { value: profile.preferredMode, onChange: (event) => updateProfile({ preferredMode: event.target.value }), children: [_jsx("option", { value: "remote", children: "remote" }), _jsx("option", { value: "hybrid", children: "hybrid" }), _jsx("option", { value: "onsite", children: "onsite" }), _jsx("option", { value: "flexible", children: "flexible" })] })] }), _jsxs("label", { className: "feature-item", children: ["Autonomy", _jsxs("select", { value: profile.autonomy, onChange: (event) => updateProfile({ autonomy: event.target.value }), children: [_jsx("option", { value: "low", children: "low" }), _jsx("option", { value: "balanced", children: "balanced" }), _jsx("option", { value: "high", children: "high" })] })] }), _jsxs("label", { className: "feature-item", children: ["Meeting load", _jsxs("select", { value: profile.meetingLoad, onChange: (event) => updateProfile({ meetingLoad: event.target.value }), children: [_jsx("option", { value: "low", children: "low" }), _jsx("option", { value: "balanced", children: "balanced" }), _jsx("option", { value: "high", children: "high" })] })] }), _jsxs("label", { className: "feature-item", children: ["Work rhythm", _jsxs("select", { value: profile.workRhythm, onChange: (event) => updateProfile({ workRhythm: event.target.value }), children: [_jsx("option", { value: "deep-work", children: "deep-work" }), _jsx("option", { value: "collaborative", children: "collaborative" }), _jsx("option", { value: "mixed", children: "mixed" })] })] }), _jsxs("label", { className: "feature-item career-wide-field", children: ["Growth goal", _jsx("textarea", { rows: 4, value: profile.growthGoal, onChange: (event) => updateProfile({ growthGoal: event.target.value }) })] })] })] }), _jsxs("section", { className: "section-block", children: [_jsxs("div", { className: "section-heading", children: [_jsx("div", { className: "eyebrow", children: "V1 boundary" }), _jsx("h2", { children: "Career intelligence, not manual review." }), _jsx("p", { children: "V1 is intentionally advisory: it can summarize, score, save, hide, and explain opportunities. External actions stay out of scope until later consent-gated versions." })] }), _jsxs("div", { className: "features-grid career-profile-grid", children: [_jsxs("article", { className: "feature-item", children: [_jsx("h3", { children: "Growth goal" }), _jsx("p", { children: profile.growthGoal })] }), _jsxs("article", { className: "feature-item", children: [_jsx("h3", { children: "Avoid patterns" }), _jsx("p", { children: profile.avoidPatterns.join(", ") })] }), _jsxs("article", { className: "feature-item", children: [_jsx("h3", { children: "Runtime hooks" }), _jsx("p", { children: "Designed to call career.profile.summarize and career.fit.score through the URAI Jobs runtime." })] })] })] }), _jsxs("section", { className: "section-block", id: "opportunities", children: [_jsxs("div", { className: "section-heading", children: [_jsx("div", { className: "eyebrow", children: "Manual Discovery" }), _jsx("h2", { children: "Opportunity fit queue." }), _jsx("p", { children: "These seeded examples prove the V1 interaction model before connecting live opportunity ingestion." })] }), _jsxs("div", { className: "career-grid", children: [_jsx("div", { className: "career-list", children: visibleOpportunities.map((item) => (_jsxs("button", { type: "button", className: item.id === selected?.id ? "preset-card active" : "preset-card", onClick: () => selectOpportunity(item.id), children: [_jsx("strong", { children: item.title }), _jsx("span", { children: item.organization }), _jsxs("span", { children: [item.fitScore, "% fit \u00B7 ", item.mode] }), item.saved && _jsx("span", { children: "saved" })] }, item.id))) }), selected ? (_jsxs("article", { className: "panel career-detail-panel", children: [_jsx("div", { className: "eyebrow", children: "Explain Match" }), _jsx("h1", { children: selected.title }), _jsx("p", { children: explainFit(selected, profile) }), _jsxs("div", { className: "status-grid", children: [_jsxs("article", { children: [_jsxs("strong", { children: [selected.fitScore, "%"] }), _jsx("span", { children: "Fit score" })] }), _jsxs("article", { children: [_jsx("strong", { children: selected.stressRisk }), _jsx("span", { children: "Stress risk" })] }), _jsxs("article", { children: [_jsx("strong", { children: selected.growthFit }), _jsx("span", { children: "Growth fit" })] })] }), _jsxs("div", { className: "hero-actions compact", children: [_jsx("button", { type: "button", onClick: () => updateOpportunity(selected.id, { saved: !selected.saved }), children: selected.saved ? "Saved" : "Save" }), _jsx("button", { type: "button", className: "secondary-button", onClick: () => hideOpportunity(selected.id), children: "Hide" }), _jsx("button", { type: "button", className: "secondary-button", onClick: () => void runFitScore(), disabled: fitJob.status === "loading", children: fitJob.status === "loading" ? "Creating score job..." : "Run runtime score" })] }), fitJob.status !== "idle" && (_jsxs("div", { className: `notice ${fitJob.status}`, children: [_jsx("strong", { children: fitJob.status.toUpperCase() }), _jsx("p", { children: fitJob.message }), fitJob.jobId && _jsx("a", { className: "secondary-button", href: "/admin", children: "View in admin" })] }))] })) : (_jsxs("article", { className: "panel", children: [_jsx("div", { className: "eyebrow", children: "No visible opportunities" }), _jsx("h1", { children: "All opportunities hidden." }), _jsx("p", { children: "Use Reset V1 state to restore the seeded opportunity queue." })] }))] })] })] }));
}
