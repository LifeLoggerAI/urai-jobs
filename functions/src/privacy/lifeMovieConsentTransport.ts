import {
  assertLifeMovieConsentDecision,
  type ExpectedLifeMovieDecision,
} from './lifeMovieConsentDecision.js';

/**
 * Jobs-only Firebase callable transport for Privacy's movie-scoped verifier.
 * This does not issue consent, establish source rights, or enable any render.
 * The supplied ID token MUST come from a reviewed server-side Jobs workload
 * identity provider; never forward a Studio/user/inbound HTTP bearer token.
 * Privacy independently verifies the token's signature, issuer, project,
 * pinned UID, system role, consumerId and Firebase custom-provider metadata.
 */
export type LifeMoviePrivacyTransportConfig = Readonly<{
  firebaseProjectId: string;
  region: string;
  dedicatedJobsUid: string;
}>;

export type LifeMoviePrivacyTransportDependencies = Readonly<{
  getDedicatedJobsFirebaseIdToken: () => Promise<string>;
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
}>;

export type LifeMoviePrivacyDecisionEvidence = Readonly<{
  decisionEventId: string;
  evaluatedAt: string;
}>;

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const PROJECT = /^[a-z][a-z0-9-]{4,39}$/;
const REGION = /^[a-z][a-z0-9-]{1,39}$/;
const HASH = /^[0-9a-f]{64}$/;
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const MAX_RESPONSE_BYTES = 16_384;
const TIMEOUT_MS = 5_000;
const DENIED = 'life_movie_consent_decision_denied';
const UNAVAILABLE = 'life_movie_consent_transport_unavailable';
const IDENTITY_UNAVAILABLE = 'life_movie_consent_jobs_identity_unavailable';

function validExpectation(expected: ExpectedLifeMovieDecision): boolean {
  if (!expected || typeof expected !== 'object') return false;
  const scope = expected.renderScope;
  return typeof expected.subjectUid === 'string' && IDENTIFIER.test(expected.subjectUid) &&
    typeof expected.tenantId === 'string' && IDENTIFIER.test(expected.tenantId) &&
    typeof expected.correlationId === 'string' && expected.correlationId.length >= 8 && expected.correlationId.length <= 160 &&
    typeof expected.decisionReceiptId === 'string' && HASH.test(expected.decisionReceiptId) &&
    !!scope && typeof scope === 'object' && !Array.isArray(scope) &&
    Reflect.ownKeys(scope).length === 3 &&
    Object.prototype.hasOwnProperty.call(scope, 'projectId') &&
    Object.prototype.hasOwnProperty.call(scope, 'renderPlanDigest') &&
    Object.prototype.hasOwnProperty.call(scope, 'sourceSetDigest') &&
    typeof scope.projectId === 'string' && IDENTIFIER.test(scope.projectId) &&
    typeof scope.renderPlanDigest === 'string' && HASH.test(scope.renderPlanDigest) &&
    typeof scope.sourceSetDigest === 'string' && HASH.test(scope.sourceSetDigest);
}

function validDedicatedJobsIdToken(
  token: unknown,
  config: LifeMoviePrivacyTransportConfig,
  nowMs: number,
): token is string {
  if (typeof token !== 'string' || token.length > 8192 || !JWT.test(token)) return false;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    const nowSeconds = Math.floor(nowMs / 1000);
    // Early rejection of obvious wrong-identity tokens. These decoded claims
    // are NOT a signature check: only the Firebase callable may authenticate.
    return payload && typeof payload === 'object' &&
      payload.aud === config.firebaseProjectId &&
      payload.iss === `https://securetoken.google.com/${config.firebaseProjectId}` &&
      payload.sub === config.dedicatedJobsUid &&
      payload.system === true && payload.role === 'system' &&
      payload.consumerId === 'urai-jobs' &&
      payload.firebase?.sign_in_provider === 'custom' &&
      Number.isSafeInteger(payload.iat) && payload.iat <= nowSeconds + 30 &&
      Number.isSafeInteger(payload.exp) && payload.exp > nowSeconds + 5 &&
      payload.exp <= nowSeconds + 2 * 3600;
  } catch {
    return false;
  }
}

/**
 * Build an immutable, HTTPS-only callable client pinned to a Firebase project,
 * region and dedicated Jobs identity. No arbitrary URLs, emulator fallback,
 * insecure redirects, caller-provided tokens, or cached allow decisions.
 *
 * This is PREPARATORY source: Jobs' lifeMovieConsentAuthorityAvailable()
 * remains false. A successful response is point-in-time evidence only, and
 * cannot bypass source-rights, revocation, lifecycle or release gates.
 */
export function createLifeMoviePrivacyTransport(
  config: LifeMoviePrivacyTransportConfig,
  dependencies: LifeMoviePrivacyTransportDependencies,
): (expected: ExpectedLifeMovieDecision) => Promise<LifeMoviePrivacyDecisionEvidence> {
  if (!config || !PROJECT.test(config.firebaseProjectId) ||
      !REGION.test(config.region) || !IDENTIFIER.test(config.dedicatedJobsUid) ||
      !dependencies || typeof dependencies.getDedicatedJobsFirebaseIdToken !== 'function') {
    throw new Error(IDENTITY_UNAVAILABLE);
  }
  const endpoint = `https://${config.region}-${config.firebaseProjectId}.cloudfunctions.net/verifyLifeMovieRenderConsent`;
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const clock = dependencies.nowMs ?? Date.now;

  return async (expected) => {
    if (!validExpectation(expected)) throw new Error('life_movie_consent_decision_invalid_expectation');
    const now = clock();
    if (!Number.isSafeInteger(now) || now <= 0) throw new Error(UNAVAILABLE);

    let token: string;
    try {
      token = await dependencies.getDedicatedJobsFirebaseIdToken();
    } catch {
      throw new Error(IDENTITY_UNAVAILABLE);
    }
    if (!validDedicatedJobsIdToken(token, config, now)) throw new Error(IDENTITY_UNAVAILABLE);

    const data = {
      subjectUid: expected.subjectUid,
      tenantId: expected.tenantId,
      correlationId: expected.correlationId,
      decisionReceiptId: expected.decisionReceiptId,
      policyVersion: '1.1.0',
      renderScope: {
        projectId: expected.renderScope.projectId,
        renderPlanDigest: expected.renderScope.renderPlanDigest,
        sourceSetDigest: expected.renderScope.sourceSetDigest,
      },
    };
    let response: Response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        redirect: 'error',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ data }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new Error(UNAVAILABLE);
    }
    if (response.status !== 200 || response.redirected ||
        !/^application\/json(?:;|$)/i.test(response.headers.get('content-type') || '')) {
      throw new Error(UNAVAILABLE);
    }
    const advertisedLength = Number(response.headers.get('content-length'));
    if ((Number.isFinite(advertisedLength) && advertisedLength > MAX_RESPONSE_BYTES)) {
      throw new Error(UNAVAILABLE);
    }
    let envelope: unknown;
    try {
      const body = await response.text();
      if (Buffer.byteLength(body, 'utf8') > MAX_RESPONSE_BYTES) throw new Error('oversize');
      envelope = JSON.parse(body);
    } catch {
      throw new Error(UNAVAILABLE);
    }
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) ||
        Reflect.ownKeys(envelope).length !== 1 ||
        !Object.prototype.hasOwnProperty.call(envelope, 'result')) {
      throw new Error(DENIED);
    }
    const decision = (envelope as { result: unknown }).result;
    // Strictly bind Privacy's result to exactly this movie/source selection,
    // tenant, user, correlation, policy, receipt and freshness window.
    assertLifeMovieConsentDecision(decision, expected, clock());
    const proof = decision as { decisionEventId: string; evaluatedAt: string };
    return { decisionEventId: proof.decisionEventId, evaluatedAt: proof.evaluatedAt };
  };
}