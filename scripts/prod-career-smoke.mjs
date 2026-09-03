import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
const REGION = process.env.GCP_REGION || 'us-central1';
const PROVIDED_ID_TOKEN = process.env.PROD_SMOKE_ID_TOKEN;
const SMOKE_UID = process.env.PROD_SMOKE_UID || 'urai-jobs-career-prod-smoke';
const SMOKE_EMAIL = process.env.PROD_SMOKE_EMAIL || 'urai-jobs-career-prod-smoke@urai.local';
const EVIDENCE_DIR = process.env.CAREER_SMOKE_EVIDENCE_DIR || 'release-evidence';

const careerSmokeCases = [
  {
    version: 'V1',
    jobType: 'career.profile.summarize',
    payload: { profile: { preferredMode: 'flexible', autonomy: 'high', meetingLoad: 'low' } },
  },
  {
    version: 'V1',
    jobType: 'career.fit.score',
    payload: { profile: { preferredMode: 'flexible', autonomy: 'high' }, opportunity: { id: 'opportunity-ai-builder', title: 'AI Workflow Builder' } },
  },
  {
    version: 'V2',
    jobType: 'career.document.parse',
    payload: { documentRef: 'gs://urai-jobs-sample-inputs/career/profile.md' },
  },
  {
    version: 'V2',
    jobType: 'career.document.tailor',
    payload: { documentRef: 'gs://urai-jobs-sample-inputs/career/profile.md', opportunity: { id: 'opportunity-ai-builder' } },
  },
  {
    version: 'V2',
    jobType: 'career.packet.generate',
    payload: { candidate: { id: 'candidate-v2-seed' }, opportunity: { id: 'opportunity-ai-builder' } },
  },
  {
    version: 'V3',
    jobType: 'career.followup.plan',
    payload: { rule: { id: 'rule-deep-work-ai-product', reviewRequired: true }, opportunity: { id: 'opportunity-ai-builder' } },
  },
  {
    version: 'V4',
    jobType: 'career.interview.prep',
    payload: { prepRoom: { id: 'interview-prep-v4-seed' }, opportunity: { id: 'opportunity-ai-builder' } },
  },
  {
    version: 'V4',
    jobType: 'career.offer.compare',
    payload: { offers: [{ id: 'offer-ai-builder' }, { id: 'offer-spatial-lead' }] },
  },
  {
    version: 'V4',
    jobType: 'career.spatial.portal.generate',
    payload: { portal: { id: 'portal-v4-seed', routeType: 'golden-path' }, opportunity: { id: 'opportunity-spatial-lead' } },
  },
  {
    version: 'V5',
    jobType: 'career.passport.export',
    payload: { passport: { activeMode: 'founder' } },
  },
];

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`[PASS] ${message}`);
}

function warn(message) {
  console.warn(`[WARN] ${message}`);
}

function initializeAdmin() {
  if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID });
}

async function getFirebaseWebApiKey() {
  const explicit = process.env.PROD_SMOKE_FIREBASE_WEB_API_KEY || process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY;
  if (explicit) return explicit;

  const accessToken = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
  const listResponse = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/webApps`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const listBody = await listResponse.json().catch(() => ({}));
  const appId = listBody.apps?.[0]?.appId;
  if (!listResponse.ok || !appId) {
    throw new Error(`Could not infer Firebase Web API key. Set PROD_SMOKE_FIREBASE_WEB_API_KEY. ${JSON.stringify(listBody)}`);
  }

  const configResponse = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/webApps/${appId}/config`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const configBody = await configResponse.json().catch(() => ({}));
  if (!configResponse.ok || !configBody.apiKey) {
    throw new Error(`Could not read Firebase Web API key. Set PROD_SMOKE_FIREBASE_WEB_API_KEY. ${JSON.stringify(configBody)}`);
  }
  return configBody.apiKey;
}

async function ensureSmokeUser() {
  initializeAdmin();
  const auth = getAuth();

  try {
    await auth.getUser(SMOKE_UID);
    pass(`Career smoke auth user exists: ${SMOKE_UID}`);
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
    await auth.createUser({ uid: SMOKE_UID, email: SMOKE_EMAIL, emailVerified: true, disabled: false });
    pass(`Created career smoke auth user: ${SMOKE_UID}`);
  }

  await auth.setCustomUserClaims(SMOKE_UID, { role: 'user', smoke: true, careerSmoke: true });
  await getFirestore().collection('users').doc(SMOKE_UID).set(
    {
      uid: SMOKE_UID,
      email: SMOKE_EMAIL,
      role: 'user',
      displayName: 'URAI Jobs Career Production Smoke',
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: 'prod-career-smoke',
    },
    { merge: true },
  );
  pass(`Career smoke Firestore user role ensured: ${SMOKE_UID}`);
}

async function mintSmokeIdToken() {
  await ensureSmokeUser();
  const apiKey = await getFirebaseWebApiKey();
  const customToken = await getAuth().createCustomToken(SMOKE_UID, { role: 'user', smoke: true, careerSmoke: true });

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.idToken) {
    throw new Error(`Could not exchange career smoke custom token: ${response.status} ${JSON.stringify(body)}`);
  }

  pass('Minted fresh Firebase Auth ID token for career smoke user.');
  return body.idToken;
}

function shouldUseProvidedToken(token) {
  return Boolean(token && token.startsWith('eyJ') && token.length > 100);
}

function hasPlaceholderSmokeToken(token) {
  return Boolean(
    token &&
      (token.includes('PASTE_') ||
        token.includes('REAL_FIREBASE_ID_TOKEN') ||
        token.includes('TOKEN_HERE') ||
        token === 'eyJ...' ||
        token.length <= 100)
  );
}

async function callCallable(idToken, name, data) {
  const url = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${name}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${idToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ data }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) {
    throw new Error(`${name} failed with ${response.status}: ${JSON.stringify(body)}`);
  }

  return body.result;
}

function ensureEvidenceDir() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

function writeEvidence(evidence) {
  ensureEvidenceDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(EVIDENCE_DIR, `career-prod-smoke-${stamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(evidence, null, 2));
  pass(`Wrote career smoke evidence: ${filePath}`);
}

if (!PROJECT_ID) fail('FIREBASE_PROJECT_ID or GCLOUD_PROJECT is required.');

async function main() {
  console.log(`[INFO] Running career production smoke against project=${PROJECT_ID}, region=${REGION}`);

  if (hasPlaceholderSmokeToken(PROVIDED_ID_TOKEN)) {
    warn('PROD_SMOKE_ID_TOKEN is set but is a placeholder or incomplete token. Ignoring it and minting a fresh smoke token.');
  }

  const hasProvidedToken = shouldUseProvidedToken(PROVIDED_ID_TOKEN);
  const idToken = hasProvidedToken ? PROVIDED_ID_TOKEN : await mintSmokeIdToken();
  if (hasProvidedToken) pass('Using provided Firebase Auth ID token for career smoke.');

  const evidence = {
    projectId: PROJECT_ID,
    region: REGION,
    createdAt: new Date().toISOString(),
    workerUrlEnvRequired: 'CAREER_WORKER_URL',
    smokeCases: [],
  };

  for (const smokeCase of careerSmokeCases) {
    const outputPrefix = `prod-career-smoke/${smokeCase.version}/${smokeCase.jobType}/${Date.now()}`;
    const createResult = await callCallable(idToken, 'createJob', {
      jobType: smokeCase.jobType,
      payload: {
        source: 'prod-career-smoke',
        version: smokeCase.version,
        outputPrefix,
        ...smokeCase.payload,
      },
    });

    const jobId = createResult?.jobId || createResult?.id;
    if (!jobId) fail(`createJob did not return jobId for ${smokeCase.jobType}: ${JSON.stringify(createResult)}`);
    pass(`${smokeCase.version} ${smokeCase.jobType} createJob returned ${jobId}`);

    const statusResult = await callCallable(idToken, 'getJob', { jobId });
    if (!statusResult) fail(`getJob returned empty result for ${smokeCase.jobType}.`);
    pass(`${smokeCase.version} ${smokeCase.jobType} getJob returned status payload.`);

    evidence.smokeCases.push({
      version: smokeCase.version,
      jobType: smokeCase.jobType,
      jobId,
      outputPrefix,
      statusResult,
    });
  }

  const versions = new Set(evidence.smokeCases.map((item) => item.version));
  ['V1', 'V2', 'V3', 'V4', 'V5'].forEach((version) => {
    if (!versions.has(version)) fail(`Career production smoke did not cover ${version}.`);
  });

  if (evidence.smokeCases.length !== 10) fail(`Expected 10 career smoke cases, got ${evidence.smokeCases.length}.`);
  writeEvidence(evidence);

  console.log('[PASS] URAI Jobs career production smoke submitted every V1-V5 career job.');
  console.log('[INFO] Confirm worker terminal states and artifacts in Firebase/GCS dashboards for all listed job IDs.');
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
