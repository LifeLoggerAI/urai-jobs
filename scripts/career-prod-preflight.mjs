const requiredEnv = [
  'FIREBASE_PROJECT_ID',
  'GCP_REGION',
  'CAREER_WORKER_URL'
];

const optionalAuthEnv = [
  'PROD_SMOKE_ID_TOKEN',
  'PROD_SMOKE_FIREBASE_WEB_API_KEY',
  'FIREBASE_WEB_API_KEY',
  'VITE_FIREBASE_API_KEY'
];

let failed = 0;

function ok(name, condition, detail = '') {
  if (condition) {
    console.log(`[PASS] ${name}${detail ? ` - ${detail}` : ''}`);
  } else {
    failed += 1;
    console.error(`[FAIL] ${name}${detail ? ` - ${detail}` : ''}`);
  }
}

function hasValue(name) {
  return typeof process.env[name] === 'string' && process.env[name].trim().length > 0;
}

requiredEnv.forEach((name) => ok(`required env ${name}`, hasValue(name)));

ok('GCP_REGION defaults are explicit', process.env.GCP_REGION === 'us-central1' || hasValue('GCP_REGION'));
ok('CAREER_WORKER_URL looks like URL', hasValue('CAREER_WORKER_URL') && /^https?:\/\//.test(process.env.CAREER_WORKER_URL));
ok('at least one smoke auth strategy is available', optionalAuthEnv.some(hasValue) || hasValue('GOOGLE_APPLICATION_CREDENTIALS') || hasValue('GCLOUD_PROJECT'));

if (hasValue('PROD_SMOKE_ID_TOKEN')) {
  ok('PROD_SMOKE_ID_TOKEN is not placeholder', !process.env.PROD_SMOKE_ID_TOKEN.includes('PASTE_') && process.env.PROD_SMOKE_ID_TOKEN.length > 100);
}

if (hasValue('GCP_SERVICE_ACCOUNT_JSON')) {
  try {
    const parsed = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON);
    ok('GCP_SERVICE_ACCOUNT_JSON parses', Boolean(parsed.client_email && parsed.private_key));
  } catch (error) {
    ok('GCP_SERVICE_ACCOUNT_JSON parses', false, error instanceof Error ? error.message : String(error));
  }
} else {
  console.log('[INFO] GCP_SERVICE_ACCOUNT_JSON not present in shell; GitHub Actions auth may still provide credentials through workload environment.');
}

if (failed) {
  throw new Error(`CAREER_PROD_PREFLIGHT ${failed} checks failed`);
}

console.log('[PASS] CAREER_PROD_PREFLIGHT');
