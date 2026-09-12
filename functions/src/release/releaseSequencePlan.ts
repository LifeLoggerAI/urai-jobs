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

export const URAI_ASSET_VERSION_CONTRACT_SOURCE = {
  repository: 'LifeLoggerAI/asset-factory',
  path: 'image_asset_generator/canonical_version_catalog.json',
  schemaVersion: '1.0.0',
} as const;

export const URAI_ASSET_VERSION_CONTRACT: Record<UraiReleaseVersion, {
  label: string;
  objective: string;
  expectedOutputs: number;
  assetPrefix: string;
  requiresSpatialWiring: boolean;
}> = {
  v1: {
    label: 'URAI V1 — Genesis Public Route World',
    objective: 'Genesis public route world and core journey.',
    expectedOutputs: 53,
    assetPrefix: 'assets/urai',
    requiresSpatialWiring: false,
  },
  v2: {
    label: 'URAI V2 — Living System States',
    objective: 'Living-state helpers, objects, memories, consent, and accessibility.',
    expectedOutputs: 80,
    assetPrefix: 'assets/urai/v2',
    requiresSpatialWiring: true,
  },
  v3: {
    label: 'URAI V3 — Relationship, Shadow and Pattern World',
    objective: 'Consent-safe relationship, shadow, and pattern world.',
    expectedOutputs: 14,
    assetPrefix: 'assets/urai/v3',
    requiresSpatialWiring: true,
  },
  v4: {
    label: 'URAI V4 — WebXR, AR and VR Pathway',
    objective: 'WebXR, AR, and VR movement, input, comfort, portals, collision, and device proof.',
    expectedOutputs: 39,
    assetPrefix: 'assets/urai/xr',
    requiresSpatialWiring: true,
  },
  v5: {
    label: 'URAI V5 — Mirror of Becoming and Autonomous Legacy',
    objective: 'Mirror of Becoming, bounded autonomy, legacy, relationships, and governance.',
    expectedOutputs: 27,
    assetPrefix: 'assets/urai/v5',
    requiresSpatialWiring: true,
  },
};

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
export type ReleasePlanInput = z.input<typeof ReleasePlanRequestSchema>;
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
    evidence: (v) => v === 'v4'
      ? ['v4.quest-device-run', 'v4.controller-or-hand-input', 'v4.comfort-review', 'v4.performance-receipt']
      : [`${v}.device-equivalent-or-waiver`],
  },
  { id: 'promote', approval: true, evidence: (v) => [`${v}.approval`, `${v}.rollback-plan`, `${v}.promotion-receipt`] },
];

export function buildReleaseSequencePlan(input: ReleasePlanInput) {
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

    const assetContract = URAI_ASSET_VERSION_CONTRACT[version];

    return {
      version,
      label: assetContract.label,
      objective: assetContract.objective,
      assetContract: {
        expectedOutputs: assetContract.expectedOutputs,
        assetPrefix: assetContract.assetPrefix,
        requiresSpatialWiring: assetContract.requiresSpatialWiring,
      },
      stages: plannedStages,
      nextAction: plannedStages.find((stage) => stage.status === 'READY')?.id ?? null,
    };
  });

  return {
    schemaVersion: 2,
    mode: 'plan-only' as const,
    dryRun: true as const,
    noSideEffects: true as const,
    readyForExecution: false as const,
    requestedThrough: request.requestedThrough,
    assetVersionContractSource: URAI_ASSET_VERSION_CONTRACT_SOURCE,
    versions,
    policy: {
      executeMustFailClosedWithoutWorker: true,
      promotionRequiresHumanApproval: true,
      questProofCannotBeInferredFromWebCI: true,
      fallbackCannotBeLabeledProduction: true,
      paidForgeRequiresExplicitAuthority: true,
      noTimeEstimates: true,
    },
    notes: request.notes ?? null,
  };
}
