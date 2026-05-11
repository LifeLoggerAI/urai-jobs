import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from "react-router-dom";
const features = [
    {
        title: "Queue every production workflow",
        body: "Submit rendering, narration, spatial, asset, analytics, and orchestration jobs into one traceable execution layer."
    },
    {
        title: "Operate with confidence",
        body: "Monitor status, attempts, failures, retries, cancellations, logs, payloads, and outputs from the admin console."
    },
    {
        title: "Built for URAI systems",
        body: "Designed around subsystem ownership, RBAC, Firebase Functions, Firestore queues, workers, and production auditability."
    },
    {
        title: "Recover from failures",
        body: "Retry failed work, cancel active work, inspect errors, and preserve a complete log trail for each job."
    },
    {
        title: "Cloud-native runtime",
        body: "Runs on Firebase, Cloud Functions, Pub/Sub, Scheduler, and Node.js 22 with deployment gates protecting production."
    },
    {
        title: "Ready to extend",
        body: "Add new job types and workers without rebuilding every product surface that depends on background execution."
    }
];
export function LandingPage() {
    return (_jsx("div", { className: "landing-page", children: _jsxs("main", { className: "page-shell", children: [_jsxs("section", { className: "hero hero-grid", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: "URAI Jobs" }), _jsx("h1", { children: "The production job layer for the URAI ecosystem." }), _jsx("p", { children: "URAI Jobs gives operators and internal systems one reliable place to create, monitor, retry, cancel, and audit complex background work." }), _jsxs("div", { className: "hero-actions", children: [_jsx(Link, { to: "/create", className: "cta-button", children: "Create a job" }), _jsx(Link, { to: "/admin", className: "secondary-button", children: "Open admin" })] })] }), _jsxs("aside", { className: "hero-card", children: [_jsx("div", { className: "eyebrow", children: "Live capabilities" }), _jsxs("ul", { className: "check-list", children: [_jsx("li", { children: "Firebase-backed job creation" }), _jsx("li", { children: "Operator admin dashboard" }), _jsx("li", { children: "Retry and cancel controls" }), _jsx("li", { children: "Payload, output, and log inspection" }), _jsx("li", { children: "Node.js 22 functions runtime" })] })] })] }), _jsxs("section", { className: "section-block", children: [_jsxs("div", { className: "section-heading", children: [_jsx("div", { className: "eyebrow", children: "Why it exists" }), _jsx("h2", { children: "One backbone for work that cannot disappear." }), _jsx("p", { children: "URAI products need background work that is observable, permissioned, resilient, and easy to reason about under production pressure." })] }), _jsx("div", { className: "features-grid", children: features.map((feature) => (_jsxs("article", { className: "feature-item", children: [_jsx("h3", { children: feature.title }), _jsx("p", { children: feature.body })] }, feature.title))) })] }), _jsxs("section", { className: "call-to-action", children: [_jsxs("div", { children: [_jsx("div", { className: "eyebrow", children: "Operator ready" }), _jsx("h2", { children: "Submit a smoke job or inspect live queue state." }), _jsx("p", { children: "Use the create page for controlled job submission and the admin page for queue visibility." })] }), _jsxs("div", { className: "hero-actions", children: [_jsx(Link, { to: "/create", className: "cta-button", children: "Create job" }), _jsx(Link, { to: "/admin", className: "secondary-button", children: "View admin" })] })] })] }) }));
}
