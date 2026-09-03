export type CandidateProfile = {
  id: string;
  displayName: string;
  headline: string;
  locationPreference: "remote" | "hybrid" | "onsite" | "flexible";
  desiredRoles: string[];
  skills: string[];
  reviewStatus: "draft" | "ready";
};

export type EmployerProfile = {
  id: string;
  name: string;
  workStyle: "async" | "collaborative" | "structured" | "mixed";
  hiringMode: "remote" | "hybrid" | "onsite" | "flexible";
  values: string[];
};

export type MarketplaceOpportunity = {
  id: string;
  title: string;
  employerId: string;
  locationMode: "remote" | "hybrid" | "onsite" | "flexible";
  summary: string;
  fitNotes: string[];
};

export type CareerDocument = {
  id: string;
  label: string;
  kind: "profile" | "resume" | "portfolio" | "notes";
  ref: string;
  status: "ready" | "needs-review";
};

export type ReviewPacket = {
  id: string;
  candidateId: string;
  opportunityId: string;
  documentIds: string[];
  status: "draft" | "review-ready";
  artifactRef?: string;
};

export const candidateProfileSeed: CandidateProfile = {
  id: "candidate-v2-seed",
  displayName: "URAI Builder",
  headline: "AI product builder focused on spatial systems, emotional intelligence, and user-owned data.",
  locationPreference: "flexible",
  desiredRoles: ["AI Product Builder", "Spatial Experience Lead", "Founder-in-Residence"],
  skills: ["product systems", "AI workflows", "spatial UX", "privacy-first design"],
  reviewStatus: "draft"
};

export const employerProfilesSeed: EmployerProfile[] = [
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

export const marketplaceOpportunitiesSeed: MarketplaceOpportunity[] = [
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

export const careerDocumentsSeed: CareerDocument[] = [
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

export const reviewPacketSeed: ReviewPacket = {
  id: "packet-v2-seed",
  candidateId: candidateProfileSeed.id,
  opportunityId: marketplaceOpportunitiesSeed[0].id,
  documentIds: careerDocumentsSeed.map((document) => document.id),
  status: "draft"
};

export function findEmployer(employerId: string) {
  return employerProfilesSeed.find((employer) => employer.id === employerId);
}
