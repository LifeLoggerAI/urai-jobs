import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const features = [
    {
        title: "Queue supported work honestly",
        body: "Submit allowlisted job types into one traceable execution layer. Worker families without proof remain gated."
    },
    {
        title: "Operate with guardrails",
        body: "Monitor status, failures, retries, cancellations, logs, payloads, and outputs from the backend-protected admin console."
    },
    {
        title: "Built for URAI systems",
        body: "Designed around subsystem ownership, RBAC, Firebase Functions, Firestore queues, workers, and auditability."
    },
    {
        title: "Recover from failures",
        body: "Retry failed work, cancel active work, inspect errors, and preserve a log trail for each job."
    },
    {
        title: "Cloud-native preview runtime",
        body: "Uses Firebase, Cloud Functions, Pub/Sub, Scheduler, and Node.js 22. Production lifecycle proof still requires an operator-gated smoke run."
    },
    {
        title: "Ready to extend safely",
        body: "New job types must be allowlisted, schema-validated, worker-authenticated, and lifecycle-smoked before being described as live."
    }
];
const careerSurfaces = [
    {
        version: "V1",
        title: "Career Mirror",
        href: "/career-mirror",
        body: "Visible product shell for editable work preferences and fit workflows. Runtime worker execution is gated until proof exists."
    },
    {
        version: "V2",
        title: "Marketplace",
        href: "/career-marketplace",
        body: "Candidate, employer, opportunity, document intake, and packet surfaces. Marketplace labor claims are preview-only until backed by real jobs."
    },
    {
        version: "V3",
        title: "Automation Controls",
        href: "/career-automation",
        body: "Rule controls, global pause, per-rule pause, and review ledger UI. Autonomous execution is not fully production verified."
    },
    {
        version: "V4",
        title: "Decision Layer",
        href: "/career-decision",
        body: "Interview prep, offer comparison, burnout-risk framing, and spatial portal surfaces with worker execution gated."
    },
    {
        version: "V5",
        title: "Passport",
        href: "/career-passport",
        body: "User-controlled profile packet and Passport export surface. Export worker execution requires proof before production claims."
    }
];
export function LandingPage() {
    return (_jsx("div", { className: "landing-page", children: _jsxs("main", { className: "page-shell", children: [_jsxs("section", { className: "hero hero-grid", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: "URAI Jobs" }), _jsx("h1", { children: "Worker infrastructure preview for the URAI ecosystem." }), _jsx("p", { children: "URAI Jobs implements Firebase job creation, queue storage, leasing, dispatcher functions, and operator visibility. Production lifecycle proof still requires an operator-gated smoke run, and some worker families remain gated until real execution replaces scaffolded handlers." }), _jsxs("div", { className: "hero-actions", children: [_jsx("a", { href: "/career-mirror", className: "cta-button", children: "Open Career Mirror" }), _jsx("a", { href: "/career-versions", className: "secondary-button", children: "View versions" }), _jsx("a", { href: "/create", className: "secondary-button", children: "Create a job" }), _jsx("a", { href: "/admin", className: "secondary-button", children: "Open admin" })] })] }), _jsxs("aside", { className: "hero-card", children: [_jsx("div", { className: "eyebrow", children: "Implemented capabilities" }), _jsxs("ul", { className: "check-list", children: [_jsx("li", { children: "Firebase-backed job creation for allowlisted job types" }), _jsx("li", { children: "Backend-protected operator admin dashboard" }), _jsx("li", { children: "Firestore queue, lease, status, result, and log documents" }), _jsx("li", { children: "Pub/Sub dispatcher with duplicate terminal no-op guard" }), _jsx("li", { children: "Inline fallback disabled by default in production" }), _jsx("li", { children: "Unimplemented worker families blocked from false success" })] })] })] }), _jsxs("section", { className: "section-block", children: [_jsxs("div", { className: "section-heading", children: [_jsx("div", { className: "eyebrow", children: "Career product surfaces" }), _jsx("h2", { children: "V1 through V5 are visible as gated product previews." }), _jsx("p", { children: "The route surfaces are present, but autonomous execution claims are intentionally withheld until each worker path has real implementation, auth, logs, results, and production lifecycle proof." })] }), _jsx("div", { className: "features-grid", children: careerSurfaces.map((surface) => (_jsxs("article", { className: "feature-item", children: [_jsx("div", { className: "eyebrow", children: surface.version }), _jsx("h3", { children: surface.title }), _jsx("p", { children: surface.body }), _jsx("div", { className: "hero-actions compact", children: _jsxs("a", { href: surface.href, className: "secondary-button", children: ["Open ", surface.version] }) })] }, surface.version))) })] }), _jsxs("section", { className: "section-block", children: [_jsxs("div", { className: "section-heading", children: [_jsx("div", { className: "eyebrow", children: "Why it exists" }), _jsx("h2", { children: "One observable backbone for background work." }), _jsx("p", { children: "URAI products need background work that is observable, permissioned, resilient, and easy to reason about under production pressure." })] }), _jsx("div", { className: "features-grid", children: features.map((feature) => (_jsxs("article", { className: "feature-item", children: [_jsx("h3", { children: feature.title }), _jsx("p", { children: feature.body })] }, feature.title))) })] }), _jsxs("section", { className: "call-to-action", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: "Operator guarded" }), _jsx("h2", { children: "Submit a controlled job or inspect queue state." }), _jsx("p", { children: "Use the create page for allowlisted job submission and the admin page for backend-protected queue visibility." })] }), _jsxs("div", { className: "hero-actions", children: [_jsx("a", { href: "/create", className: "cta-button", children: "Create job" }), _jsx("a", { href: "/admin", className: "secondary-button", children: "View admin" })] })] })] }) }));
}
