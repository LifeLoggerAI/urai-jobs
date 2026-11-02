/** Jobs-side response validation for the dedicated Privacy Life Movie verifier.
 * NOT transport authentication or permission to render. The existing
 * lifeMovieConsentAuthorityAvailable() gate remains hard closed until trusted
 * workload identity, scoped grant issuance and lifecycle checks are approved.
 */
export type LifeMovieRenderScope = Readonly<{
  projectId: string;
  renderPlanDigest: string;
  sourceSetDigest: string;
}>;

export type ExpectedLifeMovieDecision = Readonly<{
  subjectUid: string;
  tenantId: string;
  correlationId: string;
  decisionReceiptId: string;
  renderScope: LifeMovieRenderScope;
}>;

const HASH = /^[0-9a-f]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

// An authenticated JSON response must carry its own concrete authority fields.
// Prototype defaults or accessor-backed claims are not consent evidence.
const REQUIRED_DECISION_FIELDS = [
  'allowed', 'reason', 'purpose', 'policyVersion', 'requiredTier', 'subjectUid',
  'tenantId', 'correlationId', 'receiptHash', 'renderScope', 'evaluatedAt',
  'expiresAt', 'decisionEventId',
] as const;

/** Only literal own data properties can carry selected-media authority. */
function ownDataScope(scope: unknown): LifeMovieRenderScope | null {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return null;
  try {
    const value = scope as Record<string, unknown>;
    if (Reflect.ownKeys(value).length !== 3) return null;
    const props = Object.getOwnPropertyDescriptors(value);
    const keys = ['projectId', 'renderPlanDigest', 'sourceSetDigest'] as const;
    if (!keys.every(key => Object.prototype.hasOwnProperty.call(props, key) &&
        Object.prototype.hasOwnProperty.call(props[key], 'value'))) return null;
    if (typeof props.projectId.value !== 'string' ||
        typeof props.renderPlanDigest.value !== 'string' ||
        typeof props.sourceSetDigest.value !== 'string') return null;
    return {
      projectId: props.projectId.value,
      renderPlanDigest: props.renderPlanDigest.value,
      sourceSetDigest: props.sourceSetDigest.value,
    };
  } catch {
    return null;
  }
}

function exactScope(scope: unknown, expected: LifeMovieRenderScope): boolean {
  const value = ownDataScope(scope);
  return Boolean(value && value.projectId === expected.projectId &&
    value.renderPlanDigest === expected.renderPlanDigest &&
    value.sourceSetDigest === expected.sourceSetDigest);
}

/** Consume ONLY a fresh response retrieved over a reviewed, authenticated
 * Jobs-to-Privacy service transport. Caller-submitted responses are not grants.
 * The separate lifecycle processing gate remains closed.
 */
export function assertLifeMovieConsentDecision(
  decision: unknown,
  expected: ExpectedLifeMovieDecision,
  nowMs: number = Date.now(),
  maxAgeMs = 30_000,
): void {
  const expectedScopeDescriptor = expected && typeof expected === 'object'
    ? Object.getOwnPropertyDescriptor(expected, 'renderScope') : undefined;
  const expectedScope = ownDataScope(expectedScopeDescriptor &&
    Object.prototype.hasOwnProperty.call(expectedScopeDescriptor, 'value')
      ? expectedScopeDescriptor.value : undefined);
  if (!Number.isFinite(nowMs) || !Number.isSafeInteger(maxAgeMs) || maxAgeMs < 1 || maxAgeMs > 30_000 ||
      !expectedScope || !ID.test(expectedScope.projectId) || !HASH.test(expectedScope.renderPlanDigest) ||
      !HASH.test(expectedScope.sourceSetDigest) || !HASH.test(expected.decisionReceiptId) ||
      !expected.subjectUid || !expected.tenantId || !expected.correlationId) {
    throw new Error('life_movie_consent_decision_invalid_expectation');
  }
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    throw new Error('life_movie_consent_decision_denied');
  }
  const value = decision as Record<string, unknown>;
  if (!REQUIRED_DECISION_FIELDS.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && Object.prototype.hasOwnProperty.call(descriptor, 'value');
  })) {
    throw new Error('life_movie_consent_decision_denied');
  }
  const time = typeof value.evaluatedAt === 'string' ? Date.parse(value.evaluatedAt) : NaN;
  const expiry = typeof value.expiresAt === 'string' ? Date.parse(value.expiresAt) : NaN;
  const current = Number.isFinite(time) && time <= nowMs && nowMs - time <= maxAgeMs &&
    Number.isFinite(expiry) && expiry > nowMs;
  if (value.allowed !== true || value.reason !== 'ALLOWED' || value.purpose !== 'life-movie.render' ||
      value.policyVersion !== '1.1.0' || value.requiredTier !== 'C6' ||
      value.subjectUid !== expected.subjectUid || value.tenantId !== expected.tenantId ||
      value.correlationId !== expected.correlationId || value.receiptHash !== expected.decisionReceiptId ||
      typeof value.decisionEventId !== 'string' || !value.decisionEventId ||
      !exactScope(value.renderScope, expectedScope) || !current) {
    throw new Error('life_movie_consent_decision_denied');
  }
}
