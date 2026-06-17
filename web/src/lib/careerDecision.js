export const interviewPrepSeed = {
    id: "interview-prep-v4-seed",
    opportunityId: "opportunity-ai-builder",
    focusAreas: ["systems thinking", "spatial UX", "privacy-first product decisions", "shipping discipline"],
    questions: [
        "Describe a complex product system you simplified.",
        "How do you protect user trust while building automation?",
        "What would you prototype first in a spatial career interface?"
    ],
    tone: "confident"
};
export const careerOffersSeed = [
    {
        id: "offer-ai-builder",
        title: "AI Workflow Builder",
        organization: "Applied AI Lab",
        compensationLabel: "Strong base plus growth upside",
        locationMode: "remote",
        autonomyFit: "high",
        meetingLoad: "medium",
        growthFit: "high",
        burnoutRisk: "medium"
    },
    {
        id: "offer-spatial-lead",
        title: "Spatial Product Lead",
        organization: "Async Spatial Studio",
        compensationLabel: "Balanced base with creative ownership",
        locationMode: "flexible",
        autonomyFit: "high",
        meetingLoad: "low",
        growthFit: "high",
        burnoutRisk: "low"
    }
];
export const spatialCareerPortalSeed = {
    id: "portal-v4-seed",
    opportunityId: "opportunity-spatial-lead",
    label: "Golden path toward spatial product leadership",
    routeType: "golden-path",
    fieldNotes: [
        "high autonomy",
        "creative systems ownership",
        "strong match to URAI Spatial direction",
        "low meeting-load risk"
    ]
};
export function compareOffers(offers) {
    return offers.map((offer) => ({
        ...offer,
        decisionScore: (offer.autonomyFit === "high" ? 30 : offer.autonomyFit === "medium" ? 18 : 8) +
            (offer.growthFit === "high" ? 30 : offer.growthFit === "medium" ? 18 : 8) +
            (offer.meetingLoad === "low" ? 20 : offer.meetingLoad === "medium" ? 12 : 4) +
            (offer.burnoutRisk === "low" ? 20 : offer.burnoutRisk === "medium" ? 10 : 2)
    }));
}
