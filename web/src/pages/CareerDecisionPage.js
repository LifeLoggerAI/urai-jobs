import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { createJob } from "../lib/jobsApi";
import { marketplaceOpportunitiesSeed } from "../lib/careerMarketplace";
import { careerOffersSeed, compareOffers, interviewPrepSeed, spatialCareerPortalSeed } from "../lib/careerDecision";
const idleRuntimeJob = { status: "idle", message: "" };
export function CareerDecisionPage() {
    const [interviewJob, setInterviewJob] = useState(idleRuntimeJob);
    const [offerJob, setOfferJob] = useState(idleRuntimeJob);
    const [portalJob, setPortalJob] = useState(idleRuntimeJob);
    const comparedOffers = useMemo(() => compareOffers(careerOffersSeed), []);
    const selectedOpportunity = marketplaceOpportunitiesSeed[0];
    async function runInterviewPrep() {
        setInterviewJob({ status: "loading", message: "Creating career.interview.prep job..." });
        try {
            const result = await createJob("career.interview.prep", {
                source: "career-decision-v4",
                opportunity: selectedOpportunity,
                prepRoom: interviewPrepSeed,
                outputPrefix: `career-decision/interview-prep/${interviewPrepSeed.id}`
            });
            const jobId = String(result.jobId || result.id || "created");
            setInterviewJob({ status: "success", jobId, message: `Interview prep job created: ${jobId}` });
        }
        catch (error) {
            setInterviewJob({ status: "error", message: error instanceof Error ? error.message : "Interview prep job failed." });
        }
    }
    async function runOfferCompare() {
        setOfferJob({ status: "loading", message: "Creating career.offer.compare job..." });
        try {
            const result = await createJob("career.offer.compare", {
                source: "career-decision-v4",
                offers: careerOffersSeed,
                comparedOffers,
                outputPrefix: "career-decision/offer-compare"
            });
            const jobId = String(result.jobId || result.id || "created");
            setOfferJob({ status: "success", jobId, message: `Offer comparison job created: ${jobId}` });
        }
        catch (error) {
            setOfferJob({ status: "error", message: error instanceof Error ? error.message : "Offer comparison job failed." });
        }
    }
    async function runSpatialPortal() {
        setPortalJob({ status: "loading", message: "Creating career.spatial.portal.generate job..." });
        try {
            const result = await createJob("career.spatial.portal.generate", {
                source: "career-decision-v4",
                opportunity: selectedOpportunity,
                portal: spatialCareerPortalSeed,
                outputPrefix: `career-decision/spatial-portal/${spatialCareerPortalSeed.id}`
            });
            const jobId = String(result.jobId || result.id || "created");
            setPortalJob({ status: "success", jobId, message: `Spatial portal job created: ${jobId}` });
        }
        catch (error) {
            setPortalJob({ status: "error", message: error instanceof Error ? error.message : "Spatial portal job failed." });
        }
    }
    return (_jsxs("main", { className: "page-shell career-decision-shell", children: [_jsxs("section", { className: "hero career-mirror-hero", children: [_jsx("div", { className: "eyebrow", children: "Career Decision V4" }), _jsx("h1", { children: "Interview prep, offer comparison, and spatial portals." }), _jsx("p", { children: "V4 connects hiring-pipeline intelligence to decision support and URAI Spatial concepts while keeping runtime work routed through approved career jobs." }), _jsxs("div", { className: "hero-actions", children: [_jsx("a", { className: "cta-button", href: "/career-automation", children: "Open Automation V3" }), _jsx("a", { className: "secondary-button", href: "/career-versions", children: "View version console" })] })] }), _jsxs("section", { className: "section-block", children: [_jsxs("div", { className: "section-heading", children: [_jsx("div", { className: "eyebrow", children: "Interview Room" }), _jsx("h2", { children: "Prepare for the conversation before the decision." }), _jsxs("p", { children: ["Tone: ", interviewPrepSeed.tone] })] }), _jsxs("div", { className: "features-grid", children: [_jsxs("article", { className: "feature-item", children: [_jsx("h3", { children: "Focus areas" }), _jsx("p", { children: interviewPrepSeed.focusAreas.join(", ") })] }), _jsxs("article", { className: "feature-item", children: [_jsx("h3", { children: "Practice questions" }), _jsx("ul", { className: "check-list", children: interviewPrepSeed.questions.map((question) => _jsx("li", { children: question }, question)) })] })] }), _jsx("div", { className: "hero-actions", children: _jsx("button", { type: "button", onClick: () => void runInterviewPrep(), disabled: interviewJob.status === "loading", children: interviewJob.status === "loading" ? "Creating prep job..." : "Generate interview prep" }) }), interviewJob.status !== "idle" && _jsx(JobNotice, { job: interviewJob })] }), _jsxs("section", { className: "section-block", children: [_jsxs("div", { className: "section-heading", children: [_jsx("div", { className: "eyebrow", children: "Offer Oracle" }), _jsx("h2", { children: "Compare fit, growth, load, and burnout risk." })] }), _jsx("div", { className: "features-grid", children: comparedOffers.map((offer) => (_jsxs("article", { className: "feature-item", children: [_jsx("h3", { children: offer.title }), _jsx("p", { children: offer.organization }), _jsx("p", { children: offer.compensationLabel }), _jsxs("div", { className: "status-grid", children: [_jsxs("article", { children: [_jsx("strong", { children: offer.decisionScore }), _jsx("span", { children: "Decision score" })] }), _jsxs("article", { children: [_jsx("strong", { children: offer.autonomyFit }), _jsx("span", { children: "Autonomy" })] }), _jsxs("article", { children: [_jsx("strong", { children: offer.burnoutRisk }), _jsx("span", { children: "Burnout risk" })] })] })] }, offer.id))) }), _jsx("div", { className: "hero-actions", children: _jsx("button", { type: "button", onClick: () => void runOfferCompare(), disabled: offerJob.status === "loading", children: offerJob.status === "loading" ? "Creating compare job..." : "Compare offers" }) }), offerJob.status !== "idle" && _jsx(JobNotice, { job: offerJob })] }), _jsxs("section", { className: "section-block", children: [_jsxs("div", { className: "section-heading", children: [_jsx("div", { className: "eyebrow", children: "Spatial Career Portal" }), _jsx("h2", { children: spatialCareerPortalSeed.label }), _jsxs("p", { children: ["Route type: ", spatialCareerPortalSeed.routeType] })] }), _jsxs("article", { className: "panel career-detail-panel", children: [_jsx("ul", { className: "check-list", children: spatialCareerPortalSeed.fieldNotes.map((note) => _jsx("li", { children: note }, note)) }), _jsx("div", { className: "hero-actions", children: _jsx("button", { type: "button", onClick: () => void runSpatialPortal(), disabled: portalJob.status === "loading", children: portalJob.status === "loading" ? "Creating portal job..." : "Generate spatial portal" }) }), portalJob.status !== "idle" && _jsx(JobNotice, { job: portalJob })] })] })] }));
}
function JobNotice({ job }) {
    return (_jsxs("div", { className: `notice ${job.status}`, children: [_jsx("strong", { children: job.status.toUpperCase() }), _jsx("p", { children: job.message }), job.jobId && _jsx("a", { className: "secondary-button", href: "/admin", children: "View in admin" })] }));
}
