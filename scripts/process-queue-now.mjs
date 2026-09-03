const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'urai-jobs';
const region = process.env.GCP_REGION || 'us-central1';
const token = process.env.FIREBASE_ID_TOKEN || process.env.PROD_SMOKE_ID_TOKEN;
const limit = Number(process.env.QUEUE_DRAIN_LIMIT || '10');

if (!token) {
  console.error('[FAIL] FIREBASE_ID_TOKEN or PROD_SMOKE_ID_TOKEN is required.');
  process.exit(1);
}

const url = `https://${region}-${projectId}.cloudfunctions.net/processQueueNow`;
const response = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ data: { limit } }),
});

const body = await response.text();

if (!response.ok) {
  console.error(`[FAIL] processQueueNow returned ${response.status}`);
  console.error(body);
  process.exit(1);
}

console.log('[PASS] processQueueNow callable completed.');
console.log(body);
