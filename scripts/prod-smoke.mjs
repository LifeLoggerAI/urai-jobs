import { execFileSync } from 'node:child_process';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
const REGION = process.env.GCP_REGION || 'us-central1';
const PROVIDED_ID_TOKEN = process.env.PROD_SMOKE_ID_TOKEN;
const SMOKE_UID = process.env.PROD_SMOKE_UID || 'urai-jobs-prod-smoke';
const SMOKE_EMAIL = process.env.PROD_SMOKE_EMAIL || 'urai-jobs-prod-smoke@urai.local';
const JOB_TYPE = process.env.PROD_SMOKE_JOB_TYPE || 'narrator.tts';
const TEXT = process.env.PROD_SMOKE_TEXT || 'URAI Jobs Runtime production smoke test';

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`[PASS] ${message}`);
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
    pass(`Smoke auth user exists: ${SMOKE_UID}`);
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
    await auth.createUser({ uid: SMOKE_UID, email: SMOKE_EMAIL, emailVerified: true, disabled: false });
    pass(`Created smoke auth user: ${SMOKE_UID}`);
  }

  await auth.setCustomUserClaims(SMOKE_UID, { role: 'user', smoke: true });
  await getFirestore().collection('users').doc(SMOKE_UID).set(
    {
      uid: SMOKE_UID,
      email: SMOKE_EMAIL,
      role: 'user',
      displayName: 'URAI Jobs Production Smoke',
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: 'prod-smoke',
    },
    { merge: true },
  );
  pass(`Smoke Firestore user role ensured: ${SMOKE_UID}`);
}

async function mintSmokeIdToken() {
  await ensureSmokeUser();
  const apiKey = await getFirebaseWebApiKey();
  const customToken = await getAuth().createCustomToken(SMOKE_UID, { role: 'user', smoke: true });

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.idToken) {
    throw new Error(`Could not exchange smoke custom token: ${response.status} ${JSON.stringify(body)}`);
  }

  pass('Minted fresh Firebase Auth ID token for smoke user.');
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

if (!PROJECT_ID) fail('FIREBASE_PROJECT_ID or GCLOUD_PROJECT is required.');

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

async function main() {
  console.log(`[INFO] Running production smoke against project=${PROJECT_ID}, region=${REGION}`);

  if (hasPlaceholderSmokeToken(PROVIDED_ID_TOKEN)) {
    fail('PROD_SMOKE_ID_TOKEN is set but is not a real Firebase Auth ID token. Paste a full token starting with eyJ, or unset PROD_SMOKE_ID_TOKEN to let the script mint one.');
  }

  const hasProvidedToken = shouldUseProvidedToken(PROVIDED_ID_TOKEN);
  const idToken = hasProvidedToken ? PROVIDED_ID_TOKEN : await mintSmokeIdToken();
  if (hasProvidedToken) pass('Using provided Firebase Auth ID token for smoke.');

  const createResult = await callCallable(idToken, 'createJob', {
    jobType: JOB_TYPE,
    payload: {
      text: TEXT,
      voice: 'en-US-Wavenet-D',
      locale: 'en-US',
      format: 'MP3',
      outputPrefix: `prod-smoke/${Date.now()}`,
    },
  });

  const jobId = createResult?.jobId || createResult?.id;
  if (!jobId) fail(`createJob did not return jobId: ${JSON.stringify(createResult)}`);
  pass(`createJob returned ${jobId}`);

  const statusResult = await callCallable(idToken, 'getJob', { jobId });
  if (!statusResult) fail('getJob returned empty result.');
  pass(`getJob returned ${JSON.stringify(statusResult)}`);

  console.log('[PASS] URAI Jobs Runtime production smoke submitted and status callable responded.');
  console.log('[INFO] Confirm worker terminal state and artifacts in Firebase/GCS dashboards for job:', jobId);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
