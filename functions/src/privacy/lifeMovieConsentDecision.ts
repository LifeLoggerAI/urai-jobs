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
  // An expected grant must be literal, stable own-data evidence at every
  // authority-bearing field, not only its nested renderScope. Read descriptors
  // once: never execute a caller-supplied getter or reread mutable properties.
  let bound: ExpectedLifeMovieDecision | null = null;
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    try {
      const props = Object.getOwnPropertyDescriptors(expected);
      const fields = ['subjectUid', 'tenantId', 'correlationId', 'decisionReceiptId', 'renderScope'] as const;
      if (fields.every(key => Object.prototype.hasOwnProperty.call(props, key) &&
          Object.prototype.hasOwnProperty.call(props[key], 'value'))) {
        const scope = ownDataScope(props.renderScope.value);
        if (scope && typeof props.subjectUid.value === 'string' &&
            typeof props.tenantId.value === 'string' &&
            typeof props.correlationId.value === 'string' &&
            typeof props.decisionReceiptId.value === 'string') {
          bound = {
            subjectUid: props.subjectUid.value, tenantId: props.tenantId.value,
            correlationId: props.correlationId.value,
            decisionReceiptId: props.decisionReceiptId.value, renderScope: scope,
          };
        }
      }
    } catch { /* Untrusted property descriptors never establish authority. */ }
  }
  if (!Number.isFinite(nowMs) || !Number.isSafeInteger(maxAgeMs) || maxAgeMs < 1 || maxAgeMs > 30_000 ||
      !bound || !ID.test(bound.renderScope.projectId) || !HASH.test(bound.renderScope.renderPlanDigest) ||
      !HASH.test(bound.renderScope.sourceSetDigest) || !HASH.test(bound.decisionReceiptId) ||
      !bound.subjectUid || !bound.tenantId || !bound.correlationId) {
    throw new Error('life_movie_consent_decision_invalid_expectation');
  }
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    throw new Error('life_movie_consent_decision_denied');
  }
  const value = decision as Record<string, unknown>;
  // Authenticated Privacy results are evidence, not extensible JSON.
  // Reject reviewOnlyEmulator/productionAuthorized markers, unexpected claims,
  // inherited authority, accessors, symbols, or throwing property traps.
  // The real Privacy callable returns exactly these 13 own data fields.
  let exactDecision = false;
  try {
    const keys = Reflect.ownKeys(value);
    const prototype = Object.getPrototypeOf(value);
    // JSON.parse in a separate VM/test realm has its own Object.prototype.
    // Accept an ordinary cross-realm Object prototype, but not custom
    // inherited authority or caller-defined prototype metadata.
    const plainPrototype = prototype === null ||
      (Object.getPrototypeOf(prototype) === null &&
        Reflect.ownKeys(prototype).length === Reflect.ownKeys(Object.prototype).length &&
        Reflect.ownKeys(Object.prototype).every(key =>
          Object.prototype.hasOwnProperty.call(prototype, key)));
    exactDecision = plainPrototype &&
      keys.length === REQUIRED_DECISION_FIELDS.length &&
      keys.every(key => typeof key === 'string' &&
        (REQUIRED_DECISION_FIELDS as readonly string[]).includes(key)) &&
      REQUIRED_DECISION_FIELDS.every(key => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        return descriptor !== undefined && Object.prototype.hasOwnProperty.call(descriptor, 'value');
      });
  } catch {
    exactDecision = false;
  }
  if (!exactDecision) {
    throw new Error('life_movie_consent_decision_denied');
  }
  const time = typeof value.evaluatedAt === 'string' ? Date.parse(value.evaluatedAt) : NaN;
  const expiry = typeof value.expiresAt === 'string' ? Date.parse(value.expiresAt) : NaN;
  const current = Number.isFinite(time) && time <= nowMs && nowMs - time <= maxAgeMs &&
    Number.isFinite(expiry) && expiry > nowMs;
  if (value.allowed !== true || value.reason !== 'ALLOWED' || value.purpose !== 'life-movie.render' ||
      value.policyVersion !== '1.1.0' || value.requiredTier !== 'C6' ||
      value.subjectUid !== bound.subjectUid || value.tenantId !== bound.tenantId ||
      value.correlationId !== bound.correlationId || value.receiptHash !== bound.decisionReceiptId ||
      typeof value.decisionEventId !== 'string' || !value.decisionEventId ||
      !exactScope(value.renderScope, bound.renderScope) || !current) {
    throw new Error('life_movie_consent_decision_denied');
  }
}
