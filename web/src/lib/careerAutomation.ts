export type AutomationRuleStatus = "active" | "paused";

export type CareerAutomationRule = {
  id: string;
  name: string;
  status: AutomationRuleStatus;
  salaryMinimum: number;
  locationModes: Array<"remote" | "hybrid" | "onsite" | "flexible">;
  allowedRoleKeywords: string[];
  excludedCompanyKeywords: string[];
  maxWeeklyRuns: number;
  reviewRequired: true;
};

export type CareerExecutionLedgerEntry = {
  id: string;
  ruleId: string;
  opportunityId: string;
  action: "plan-followup" | "quality-check" | "duplicate-check";
  status: "queued" | "review-ready" | "paused";
  artifactRef?: string;
  createdAt: string;
};

export type CareerAutomationControlState = {
  globalPause: boolean;
  rules: CareerAutomationRule[];
  ledger: CareerExecutionLedgerEntry[];
};

export const careerAutomationSeed: CareerAutomationControlState = {
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

export function toggleRuleStatus(rule: CareerAutomationRule): CareerAutomationRule {
  return { ...rule, status: rule.status === "active" ? "paused" : "active" };
}

export function createLedgerEntry(ruleId: string, opportunityId: string): CareerExecutionLedgerEntry {
  return {
    id: `ledger-${Date.now()}`,
    ruleId,
    opportunityId,
    action: "plan-followup",
    status: "queued",
    createdAt: new Date().toISOString()
  };
}
