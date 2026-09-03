import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { createJob } from "../lib/jobsApi";
import { candidateProfileSeed, careerDocumentsSeed, findEmployer, marketplaceOpportunitiesSeed, reviewPacketSeed } from "../lib/careerMarketplace";
const idleRuntimeJob = { status: "idle", message: "" };
export function CareerMarketplacePage() {
    const [selectedOpportunityId, setSelectedOpportunityId] = useState(marketplaceOpportunitiesSeed[0]?.id ?? "");
    const [documentJob, setDocumentJob] = useState(idleRuntimeJob);
    const [tailorJob, setTailorJob] = useState(idleRuntimeJob);
    const [packetJob, setPacketJob] = useState(idleRuntimeJob);
    const selectedOpportunity = marketplaceOpportunitiesSeed.find((item) => item.id === selectedOpportunityId) ?? marketplaceOpportunitiesSeed[0];
    const selectedEmployer = selectedOpportunity ? findEmployer(selectedOpportunity.employerId) : undefined;
    const primaryDocument = careerDocumentsSeed[0];
    async function runDocumentParse() {
        setDocumentJob({ status: "loading", message: "Creating career.document.parse job..." });
        try {
            const result = await createJob("career.document.parse", {
                source: "career-marketplace-v2",
                documentRef: primaryDocument.ref,
                documentKind: primaryDocument.kind,
                outputPrefix: `career-marketplace/document-parse/${primaryDocument.id}`
            });
            const jobId = String(result.jobId || result.id || "created");
            setDocumentJob({ status: "success", jobId, message: `Document parse job created: ${jobId}` });
        }
        catch (error) {
            setDocumentJob({ status: "error", message: error instanceof Error ? error.message : "Document parse job failed." });
        }
    }
    async function runDocumentTailor() {
        if (!selectedOpportunity)
            return;
        setTailorJob({ status: "loading", message: "Creating career.document.tailor job..." });
        try {
            const result = await createJob("career.document.tailor", {
                source: "career-marketplace-v2",
                candidate: candidateProfileSeed,
                opportunity: selectedOpportunity,
                documentRef: primaryDocument.ref,
                outputPrefix: `career-marketplace/document-tailor/${selectedOpportunity.id}`
            });
            const jobId = String(result.jobId || result.id || "created");
            setTailorJob({ status: "success", jobId, message: `Document tailoring job created: ${jobId}` });
        }
        catch (error) {
            setTailorJob({ status: "error", message: error instanceof Error ? error.message : "Document tailoring job failed." });
        }
    }
    async function runPacketGenerate() {
        if (!selectedOpportunity)
            return;
        setPacketJob({ status: "loading", message: "Creating career.packet.generate job..." });
        try {
            const result = await createJob("career.packet.generate", {
                source: "career-marketplace-v2",
                candidate: candidateProfileSeed,
                opportunity: selectedOpportunity,
                packet: reviewPacketSeed,
                documents: careerDocumentsSeed,
                outputPrefix: `career-marketplace/packet/${selectedOpportunity.id}`
            });
            const jobId = String(result.jobId || result.id || "created");
            setPacketJob({ status: "success", jobId, message: `Review packet job created: ${jobId}` });
        }
        catch (error) {
            setPacketJob({ status: "error", message: error instanceof Error ? error.message : "Review packet job failed." });
        }
    }
    return (_jsxs("main", { className: "page-shell career-marketplace-shell", children: [_jsxs("section", { className: "hero career-mirror-hero", children: [_jsx("div", { className: "eyebrow", children: "Career Marketplace V2" }), _jsx("h1", { children: "Profiles, documents, and review packets." }), _jsx("p", { children: "V2 adds candidate and employer profiles, opportunity details, document intake, and packet generation. Outputs remain review artifacts inside URAI-Jobs." }), _jsxs("div", { className: "hero-actions", children: [_jsx("a", { className: "cta-button", href: "/career-mirror", children: "Back to Career Mirror" }), _jsx("a", { className: "secondary-button", href: "/career-versions", children: "View version console" })] })] }), _jsxs("section", { className: "section-block", children: [_jsxs("div", { className: "section-heading", children: [_jsx("div", { className: "eyebrow", children: "Candidate" }), _jsx("h2", { children: candidateProfileSeed.displayName }), _jsx("p", { children: candidateProfileSeed.headline })] }), _jsxs("div", { className: "features-grid", children: [_jsxs("article", { className: "feature-item", children: [_jsx("h3", { children: "Desired roles" }), _jsx("p", { children: candidateProfileSeed.desiredRoles.join(", ") })] }), _jsxs("article", { className: "feature-item", children: [_jsx("h3", { children: "Skills" }), _jsx("p", { children: candidateProfileSeed.skills.join(", ") })] }), _jsxs("article", { className: "feature-item", children: [_jsx("h3", { children: "Location preference" }), _jsx("p", { children: candidateProfileSeed.locationPreference })] })] })] }), _jsxs("section", { className: "section-block", children: [_jsxs("div", { className: "section-heading", children: [_jsx("div", { className: "eyebrow", children: "Opportunities" }), _jsx("h2", { children: "Review opportunity detail before generating artifacts." })] }), _jsxs("div", { className: "career-grid", children: [_jsx("div", { className: "career-list", children: marketplaceOpportunitiesSeed.map((item) => (_jsxs("button", { className: item.id === selectedOpportunity?.id ? "preset-card active" : "preset-card", type: "button", onClick: () => setSelectedOpportunityId(item.id), children: [_jsx("strong", { children: item.title }), _jsx("span", { children: findEmployer(item.employerId)?.name ?? "Unknown employer" }), _jsx("span", { children: item.locationMode })] }, item.id))) }), selectedOpportunity && (_jsxs("article", { className: "panel career-detail-panel", children: [_jsx("div", { className: "eyebrow", children: "Opportunity Detail" }), _jsx("h1", { children: selectedOpportunity.title }), _jsx("p", { children: selectedOpportunity.summary }), _jsxs("div", { className: "status-grid", children: [_jsxs("article", { children: [_jsx("strong", { children: selectedEmployer?.name ?? "Unknown" }), _jsx("span", { children: "Employer" })] }), _jsxs("article", { children: [_jsx("strong", { children: selectedEmployer?.workStyle ?? "mixed" }), _jsx("span", { children: "Work style" })] }), _jsxs("article", { children: [_jsx("strong", { children: selectedOpportunity.locationMode }), _jsx("span", { children: "Location mode" })] })] }), _jsx("ul", { className: "check-list", children: selectedOpportunity.fitNotes.map((note) => _jsx("li", { children: note }, note)) })] }))] })] }), _jsxs("section", { className: "section-block", children: [_jsxs("div", { className: "section-heading", children: [_jsx("div", { className: "eyebrow", children: "Documents and packet jobs" }), _jsx("h2", { children: "Generate review artifacts." }), _jsx("p", { children: "These actions create runtime jobs for parsing, tailoring, and packet generation." })] }), _jsx("div", { className: "features-grid", children: careerDocumentsSeed.map((document) => (_jsxs("article", { className: "feature-item", children: [_jsx("h3", { children: document.label }), _jsxs("p", { children: [document.kind, " \u00B7 ", document.status] }), _jsx("code", { children: document.ref })] }, document.id))) }), _jsxs("div", { className: "hero-actions", children: [_jsx("button", { type: "button", onClick: () => void runDocumentParse(), disabled: documentJob.status === "loading", children: documentJob.status === "loading" ? "Creating parse job..." : "Parse document" }), _jsx("button", { type: "button", className: "secondary-button", onClick: () => void runDocumentTailor(), disabled: tailorJob.status === "loading", children: tailorJob.status === "loading" ? "Creating tailor job..." : "Tailor document" }), _jsx("button", { type: "button", className: "secondary-button", onClick: () => void runPacketGenerate(), disabled: packetJob.status === "loading", children: packetJob.status === "loading" ? "Creating packet job..." : "Generate packet" })] }), [documentJob, tailorJob, packetJob].map((job, index) => (job.status !== "idle" ? (_jsxs("div", { className: `notice ${job.status}`, children: [_jsx("strong", { children: job.status.toUpperCase() }), _jsx("p", { children: job.message }), job.jobId && _jsx("a", { className: "secondary-button", href: "/admin", children: "View in admin" })] }, `${job.status}-${index}`)) : null))] })] }));
}
