import { z } from 'zod';

export const URAI_RELEASE_VERSIONS = ['v1', 'v2', 'v3', 'v4', 'v5'] as const;
export const URAI_RELEASE_STAGES = [
  'audit',
  'world-spec',
  'asset-inventory',
  'forge-models',
  'integrate',
  'verify-web',
  'verify-device',
  'promote',
] as const;

export type UraiReleaseVersion = (typeof URAI_RELEASE_VERSIONS)[number];
export type UraiReleaseStage = (typeof URAI_RELEASE_STAGES)[number];

const VersionSchema = z.enum(URAI_RELEASE_VERSIONS);
const StageSchema = z.enum(URAI_RELEASE_STAGES);

export const ReleasePlanRequestSchema = z.object({
  versions: z.array(VersionSchema).min(1).default([...URAI_RELEASE_VERSIONS]),
  requestedThrough: StageSchema.default('verify-web'),
  dryRun: z.literal(true).default(true),
  evidence: z.record(z.boolean()).default({}),
  notes: z.string().max(4000).optional(),
});

export type ReleasePlanRequest = z.infer<typeof ReleasePlanRequestSchema>;
type StageStatus = 'COMPLETE' | 'READY' | 'BLOCKED' | 'NOT_REQUESTED';

type StageDefinition = {
  id: UraiReleaseStage;
  evidence: (version: UraiReleaseVersion) => string[];
  approval?: boolean;
  deviceOnly?: boolean;
};

const stages: StageDefinition[] = [
  { id: 'audit', evidence: (v) => [`${v}.repository-audit`] },
  { id: 'world-spec', evidence: (v) => [`${v}.world-spec`] },
  { id: 'asset-inventory', evidence: (v) => [`${v}.asset-inventory`, `${v}.naming-map`] },
  { id: 'forge-models', evidence: (v) => [`${v}.model-manifest`, `${v}.lod-manifest`, `${v}.collision-manifest`] },
  { id: 'integrate', evidence: (v) => [`${v}.integration-receipt`, `${v}.fallback-receipt`] },
  { id: 'verify-web', evidence: (v) => [`${v}.typecheck`, `${v}.build`, `${v}.browser-smoke`, `${v}.accessibility`] },
  {
    id: 'verify-device',
    deviceOnly: true,
    evidence: (v) => v === 'v3'
      ? ['v3.quest-device-run', 'v3.controller-or-hand-input', 'v3.comfort-review', 'v3.performance-receipt']
      : [`${v}.device-equivalent-or-waiver`],
  },
  { id: 'promote', approval: true, evidence: (v) => [`${v}.approval`, `${v}.rollback-plan`, `${v}.promotion-receipt`] },
];

const objectives: Record<UraiReleaseVersion, string> = {
  v1: 'Public route world and core journey.',
  v2: 'Living-state helpers, objects, memories, consent, and accessibility.',
  v3: 'Spatial/XR movement, input, comfort, portals, collision, and device proof.',
  v4: 'Autonomous council and bounded operations with approval gates.',
  v5: 'Relationships, legacy, governance, and whole-life convergence.',
};

export function buildReleaseSequencePlan(input: ReleasePlanRequest) {
  const request = ReleasePlanRequestSchema.parse(input);
  const through = URAI_RELEASE_STAGES.indexOf(request.requestedThrough);

  const versions = request.versions.map((version) => {
    let priorComplete = true;
    const plannedStages = stages.map((stage, index) => {
      const requiredEvidence = stage.evidence(version);
      const requested = index <= through;
      const complete = requiredEvidence.every((key) => request.evidence[key] === true);
      let status: StageStatus = 'NOT_REQUESTED';

      if (requested && priorComplete && complete) status = 'COMPLETE';
      else if (requested && priorComplete) status = 'READY';
      else if (requested) status = 'BLOCKED';

      if (requested && !complete) priorComplete = false;

      return {
        id: stage.id,
        status,
        requiredEvidence,
        missingEvidence: requiredEvidence.filter((key) => request.evidence[key] !== true),
        requiresApproval: stage.approval === true,
        deviceOnly: stage.deviceOnly === true,
      };
    });

    return {
      version,
      objective: objectives[version],
      stages: plannedStages,
      nextAction: plannedStages.find((stage) => stage.status === 'READY')?.id ?? null,
    };
  });

  return {
    schemaVersion: 1,
    mode: 'plan-only' as const,
    dryRun: true as const,
    noSideEffects: true as const,
    readyForExecution: false as const,
    requestedThrough: request.requestedThrough,
    versions,
    policy: {
      executeMustFailClosedWithoutWorker: true,
      promotionRequiresHumanApproval: true,
      questProofCannotBeInferredFromWebCI: true,
      fallbackCannotBeLabeledProduction: true,
      noTimeEstimates: true,
    },
    notes: request.notes ?? null,
  };
}
