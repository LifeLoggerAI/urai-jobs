import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { createJob } from "../lib/jobsApi";
import { marketplaceOpportunitiesSeed } from "../lib/careerMarketplace";
import { careerAutomationSeed, createLedgerEntry, toggleRuleStatus } from "../lib/careerAutomation";
const idleRuntimeJob = { status: "idle", message: "" };
export function CareerAutomationPage() {
    const [state, setState] = useState(careerAutomationSeed);
    const [runtimeJob, setRuntimeJob] = useState(idleRuntimeJob);
    const selectedOpportunity = marketplaceOpportunitiesSeed[0];
    function toggleGlobalPause() {
        setState((current) => ({ ...current, globalPause: !current.globalPause }));
    }
    function toggleRule(ruleId) {
        setState((current) => ({
            ...current,
            rules: current.rules.map((rule) => (rule.id === ruleId ? toggleRuleStatus(rule) : rule))
        }));
    }
    function appendLedger(entry) {
        setState((current) => ({ ...current, ledger: [entry, ...current.ledger] }));
    }
    async function runFollowupPlan(ruleId) {
        if (state.globalPause) {
            setRuntimeJob({ status: "error", message: "Global pause is enabled. Resume controls before creating a follow-up plan." });
            return;
        }
        const rule = state.rules.find((item) => item.id === ruleId);
        if (!rule || rule.status === "paused") {
            setRuntimeJob({ status: "error", message: "Selected rule is paused." });
            return;
        }
        const ledgerEntry = createLedgerEntry(ruleId, selectedOpportunity.id);
        appendLedger(ledgerEntry);
        setRuntimeJob({ status: "loading", message: "Creating career.followup.plan job..." });
        try {
            const result = await createJob("career.followup.plan", {
                source: "career-automation-v3",
                rule,
                opportunity: selectedOpportunity,
                ledgerEntry,
                outputPrefix: `career-automation/followup-plan/${ledgerEntry.id}`
            });
            const jobId = String(result.jobId || result.id || "created");
            setRuntimeJob({ status: "success", jobId, message: `Follow-up plan job created: ${jobId}` });
            setState((current) => ({
                ...current,
                ledger: current.ledger.map((entry) => entry.id === ledgerEntry.id ? { ...entry, status: "review-ready", artifactRef: `job:${jobId}` } : entry)
            }));
        }
        catch (error) {
            setRuntimeJob({ status: "error", message: error instanceof Error ? error.message : "Follow-up plan job failed." });
        }
    }
    return (_jsxs("main", { className: "page-shell career-automation-shell", children: [_jsxs("section", { className: "hero career-mirror-hero", children: [_jsx("div", { className: "eyebrow", children: "Career Automation V3" }), _jsx("h1", { children: "Bounded controls, pauses, and review ledger." }), _jsx("p", { children: "V3 introduces explicit rule controls, global pause, per-rule pause, and a ledger for reviewable automation artifacts. This page plans follow-up artifacts only; it does not perform external actions." }), _jsxs("div", { className: "hero-actions", children: [_jsx("button", { type: "button", onClick: toggleGlobalPause, children: state.globalPause ? "Resume global controls" : "Pause globally" }), _jsx("a", { className: "secondary-button", href: "/career-marketplace", children: "Open Marketplace V2" }), _jsx("a", { className: "secondary-button", href: "/career-versions", children: "View version console" })] })] }), _jsxs("section", { className: "section-block", children: [_jsxs("div", { className: "section-heading", children: [_jsx("div", { className: "eyebrow", children: "Rules" }), _jsx("h2", { children: "Every rule is explicit, pausable, and review-required." })] }), _jsx("div", { className: "features-grid", children: state.rules.map((rule) => (_jsxs("article", { className: "feature-item", children: [_jsxs("div", { className: "launch-stage-header", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: rule.status }), _jsx("h3", { children: rule.name })] }), _jsx("span", { className: "launch-status", children: "review" })] }), _jsxs("p", { children: ["Minimum salary: $", rule.salaryMinimum.toLocaleString()] }), _jsxs("p", { children: ["Modes: ", rule.locationModes.join(", ")] }), _jsxs("p", { children: ["Allowed: ", rule.allowedRoleKeywords.join(", ")] }), _jsxs("p", { children: ["Excluded: ", rule.excludedCompanyKeywords.join(", ")] }), _jsxs("p", { children: ["Max weekly runs: ", rule.maxWeeklyRuns] }), _jsxs("div", { className: "hero-actions compact", children: [_jsx("button", { type: "button", onClick: () => toggleRule(rule.id), children: rule.status === "active" ? "Pause rule" : "Resume rule" }), _jsx("button", { type: "button", className: "secondary-button", onClick: () => void runFollowupPlan(rule.id), disabled: runtimeJob.status === "loading" || state.globalPause || rule.status === "paused", children: runtimeJob.status === "loading" ? "Creating plan..." : "Create follow-up plan" })] })] }, rule.id))) })] }), runtimeJob.status !== "idle" && (_jsx("section", { className: "section-block", children: _jsxs("div", { className: `notice ${runtimeJob.status}`, children: [_jsx("strong", { children: runtimeJob.status.toUpperCase() }), _jsx("p", { children: runtimeJob.message }), runtimeJob.jobId && _jsx("a", { className: "secondary-button", href: "/admin", children: "View in admin" })] }) })), _jsxs("section", { className: "section-block", children: [_jsxs("div", { className: "section-heading", children: [_jsx("div", { className: "eyebrow", children: "Ledger" }), _jsx("h2", { children: "Review trail for bounded automation." }), _jsxs("p", { children: ["Global pause: ", state.globalPause ? "enabled" : "off"] })] }), _jsx("div", { className: "features-grid", children: state.ledger.map((entry) => (_jsxs("article", { className: "feature-item", children: [_jsx("h3", { children: entry.action }), _jsxs("p", { children: ["Status: ", entry.status] }), _jsxs("p", { children: ["Rule: ", entry.ruleId] }), _jsxs("p", { children: ["Opportunity: ", entry.opportunityId] }), _jsxs("p", { children: ["Created: ", new Date(entry.createdAt).toLocaleString()] }), entry.artifactRef && _jsx("code", { children: entry.artifactRef })] }, entry.id))) })] })] }));
}
