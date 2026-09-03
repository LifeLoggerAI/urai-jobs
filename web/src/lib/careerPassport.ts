export type CareerMode = "founder" | "freelancer" | "employee" | "student" | "rebuild";

export type PassportProfilePacket = {
  id: string;
  label: string;
  mode: CareerMode;
  visibility: "private" | "review" | "revocable";
  strengths: string[];
  workPreferences: string[];
  consentNotes: string[];
};

export type EconomicPathNode = {
  id: string;
  label: string;
  category: "job" | "freelance" | "consulting" | "grant" | "accelerator" | "partnership" | "licensing" | "creator" | "founder";
  stage: "now" | "next" | "later";
  fit: "low" | "medium" | "high";
  notes: string[];
};

export type SkillGap = {
  id: string;
  skill: string;
  priority: "low" | "medium" | "high";
  suggestedProject: string;
};

export type CareerPassportState = {
  activeMode: CareerMode;
  packets: PassportProfilePacket[];
  pathNodes: EconomicPathNode[];
  skillGaps: SkillGap[];
};

export const careerPassportSeed: CareerPassportState = {
  activeMode: "founder",
  packets: [
    {
      id: "passport-founder-private",
      label: "Founder systems profile",
      mode: "founder",
      visibility: "private",
      strengths: ["product vision", "symbolic UX", "AI workflow design", "privacy-first architecture"],
      workPreferences: ["deep work", "high autonomy", "mission-driven systems", "low meeting density"],
      consentNotes: ["private by default", "review before sharing", "revocable profile packet"]
    },
    {
      id: "passport-builder-review",
      label: "Builder collaboration profile",
      mode: "freelancer",
      visibility: "review",
      strengths: ["rapid prototyping", "creative direction", "technical product strategy"],
      workPreferences: ["async collaboration", "clear ownership", "outcome-based work"],
      consentNotes: ["review artifact", "no raw behavioral data", "user-controlled scope"]
    }
  ],
  pathNodes: [
    {
      id: "path-founder-urai",
      label: "Founder path: URAI platform buildout",
      category: "founder",
      stage: "now",
      fit: "high",
      notes: ["highest ownership", "aligned with spatial OS", "long-term upside"]
    },
    {
      id: "path-consulting-ai-workflows",
      label: "Consulting path: AI workflow systems",
      category: "consulting",
      stage: "next",
      fit: "high",
      notes: ["near-term revenue", "uses current strengths", "low inventory cost"]
    },
    {
      id: "path-creator-spatial-storytelling",
      label: "Creator path: spatial storytelling channel",
      category: "creator",
      stage: "later",
      fit: "medium",
      notes: ["brand expansion", "requires cadence", "supports URAI narrative"]
    }
  ],
  skillGaps: [
    {
      id: "gap-enterprise-sales",
      skill: "enterprise sales motion",
      priority: "medium",
      suggestedProject: "Create a one-page URAI Jobs enterprise pilot brief."
    },
    {
      id: "gap-spatial-demo-reel",
      skill: "spatial demo packaging",
      priority: "high",
      suggestedProject: "Build a thirty-second spatial career portal walkthrough."
    }
  ]
};

export function buildPassportExportPayload(state: CareerPassportState) {
  return {
    activeMode: state.activeMode,
    packetIds: state.packets.map((packet) => packet.id),
    pathNodeIds: state.pathNodes.map((node) => node.id),
    skillGapIds: state.skillGaps.map((gap) => gap.id),
    generatedAt: new Date().toISOString()
  };
}
