export type WorkPreferenceProfile = {
  preferredMode: "remote" | "hybrid" | "onsite" | "flexible";
  autonomy: "low" | "balanced" | "high";
  meetingLoad: "low" | "balanced" | "high";
  workRhythm: "deep-work" | "collaborative" | "mixed";
  growthGoal: string;
  avoidPatterns: string[];
};

export type CareerOpportunity = {
  id: string;
  title: string;
  organization: string;
  mode: WorkPreferenceProfile["preferredMode"];
  fitScore: number;
  stressRisk: "low" | "medium" | "high";
  growthFit: "low" | "medium" | "high";
  explanation: string;
  saved: boolean;
  hidden: boolean;
};

export const defaultWorkPreferenceProfile: WorkPreferenceProfile = {
  preferredMode: "flexible",
  autonomy: "high",
  meetingLoad: "low",
  workRhythm: "deep-work",
  growthGoal: "Find work that supports focused building, creative systems thinking, and long-term ownership.",
  avoidPatterns: ["unclear ownership", "heavy meeting load", "commission-only structure"]
};

export const careerMirrorOpportunities: CareerOpportunity[] = [
  {
    id: "urai-career-ai-product-builder",
    title: "AI Product Builder",
    organization: "Mission-driven product team",
    mode: "flexible",
    fitScore: 94,
    stressRisk: "low",
    growthFit: "high",
    explanation: "Strong fit for autonomous systems work, product judgment, and deep creative execution.",
    saved: false,
    hidden: false
  },
  {
    id: "urai-career-spatial-experience-lead",
    title: "Spatial Experience Lead",
    organization: "3D emotional interface studio",
    mode: "hybrid",
    fitScore: 89,
    stressRisk: "medium",
    growthFit: "high",
    explanation: "High creative alignment with URAI Spatial, but collaboration load should be checked before pursuing.",
    saved: false,
    hidden: false
  },
  {
    id: "urai-career-ops-heavy-role",
    title: "Operations Coordinator",
    organization: "High-volume service company",
    mode: "onsite",
    fitScore: 48,
    stressRisk: "high",
    growthFit: "low",
    explanation: "Lower fit because it likely repeats high-friction scheduling, reactive tasks, and low-autonomy patterns.",
    saved: false,
    hidden: false
  }
];

export function explainFit(opportunity: CareerOpportunity, profile: WorkPreferenceProfile): string {
  const alignment = opportunity.fitScore >= 85 ? "strong" : opportunity.fitScore >= 65 ? "moderate" : "weak";
  return `${opportunity.title} has a ${alignment} fit because your profile favors ${profile.workRhythm} rhythm, ${profile.autonomy} autonomy, and ${profile.meetingLoad} meeting load. ${opportunity.explanation}`;
}
