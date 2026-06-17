export const careerAutomationSeed = {
    globalPause: false,
    rules: [
        {
            id: "rule-deep-work-ai-product",
            name: "Deep-work AI product roles",
            status: "active",
            salaryMinimum: 120000,
            locationModes: ["remote", "flexible"],
            allowedRoleKeywords: ["AI", "product", "builder", "spatial"],
            excludedCompanyKeywords: ["commission", "staffing", "door-to-door"],
            maxWeeklyRuns: 10,
            reviewRequired: true
        },
        {
            id: "rule-spatial-creative-lead",
            name: "Spatial creative leadership",
            status: "paused",
            salaryMinimum: 100000,
            locationModes: ["hybrid", "flexible"],
            allowedRoleKeywords: ["spatial", "experience", "creative", "lead"],
            excludedCompanyKeywords: ["relocation required"],
            maxWeeklyRuns: 4,
            reviewRequired: true
        }
    ],
    ledger: [
        {
            id: "ledger-v3-seed",
            ruleId: "rule-deep-work-ai-product",
            opportunityId: "opportunity-ai-builder",
            action: "plan-followup",
            status: "review-ready",
            artifactRef: "gs://urai-jobs-sample-output/career/followup-plan.json",
            createdAt: "2026-06-04T00:00:00.000Z"
        }
    ]
};
export function toggleRuleStatus(rule) {
    return { ...rule, status: rule.status === "active" ? "paused" : "active" };
}
export function createLedgerEntry(ruleId, opportunityId) {
    return {
        id: `ledger-${Date.now()}`,
        ruleId,
        opportunityId,
        action: "plan-followup",
        status: "queued",
        createdAt: new Date().toISOString()
    };
}
