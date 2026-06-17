export const candidateProfileSeed = {
    id: "candidate-v2-seed",
    displayName: "URAI Builder",
    headline: "AI product builder focused on spatial systems, emotional intelligence, and user-owned data.",
    locationPreference: "flexible",
    desiredRoles: ["AI Product Builder", "Spatial Experience Lead", "Founder-in-Residence"],
    skills: ["product systems", "AI workflows", "spatial UX", "privacy-first design"],
    reviewStatus: "draft"
};
export const employerProfilesSeed = [
    {
        id: "employer-async-studio",
        name: "Async Spatial Studio",
        workStyle: "async",
        hiringMode: "flexible",
        values: ["deep work", "creative ownership", "humane systems"]
    },
    {
        id: "employer-ai-lab",
        name: "Applied AI Lab",
        workStyle: "mixed",
        hiringMode: "remote",
        values: ["experimentation", "shipping", "responsible AI"]
    }
];
export const marketplaceOpportunitiesSeed = [
    {
        id: "opportunity-spatial-lead",
        title: "Spatial Product Lead",
        employerId: "employer-async-studio",
        locationMode: "flexible",
        summary: "Lead spatial product concepts from prototype to shippable user experience.",
        fitNotes: ["high autonomy", "creative systems work", "low meeting load"]
    },
    {
        id: "opportunity-ai-builder",
        title: "AI Workflow Builder",
        employerId: "employer-ai-lab",
        locationMode: "remote",
        summary: "Design and ship AI-powered workflows for real users and internal teams.",
        fitNotes: ["product judgment", "agentic workflows", "shipping rhythm"]
    }
];
export const careerDocumentsSeed = [
    {
        id: "document-profile-notes",
        label: "Profile notes",
        kind: "profile",
        ref: "gs://urai-jobs-sample-inputs/career/profile.md",
        status: "ready"
    },
    {
        id: "document-portfolio-notes",
        label: "Portfolio notes",
        kind: "portfolio",
        ref: "gs://urai-jobs-sample-inputs/career/portfolio.md",
        status: "needs-review"
    }
];
export const reviewPacketSeed = {
    id: "packet-v2-seed",
    candidateId: candidateProfileSeed.id,
    opportunityId: marketplaceOpportunitiesSeed[0].id,
    documentIds: careerDocumentsSeed.map((document) => document.id),
    status: "draft"
};
export function findEmployer(employerId) {
    return employerProfilesSeed.find((employer) => employer.id === employerId);
}
