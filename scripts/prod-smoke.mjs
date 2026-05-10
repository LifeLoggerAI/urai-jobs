const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
const REGION = process.env.GCP_REGION || "us-central1";
const ID_TOKEN = process.env.PROD_SMOKE_ID_TOKEN;
const JOB_TYPE = process.env.PROD_SMOKE_JOB_TYPE || "narrator.tts";
const TEXT = process.env.PROD_SMOKE_TEXT || "URAI Jobs Runtime production smoke test";

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`[PASS] ${message}`);
}

if (!PROJECT_ID) fail("FIREBASE_PROJECT_ID or GCLOUD_PROJECT is required.");
if (!ID_TOKEN) fail("PROD_SMOKE_ID_TOKEN is required. Use a short-lived Firebase Auth ID token for an admin/operator or smoke user.");

async function callCallable(name, data) {
  const url = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${name}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${ID_TOKEN}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ data })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) {
    throw new Error(`${name} failed with ${response.status}: ${JSON.stringify(body)}`);
  }

  return body.result;
}

async function main() {
  console.log(`[INFO] Running production smoke against project=${PROJECT_ID}, region=${REGION}`);

  const createResult = await callCallable("createJob", {
    jobType: JOB_TYPE,
    payload: {
      text: TEXT,
      voice: "en-US-Wavenet-D",
      locale: "en-US",
      format: "MP3",
      outputPrefix: `prod-smoke/${Date.now()}`
    }
  });

  const jobId = createResult?.jobId || createResult?.id;
  if (!jobId) fail(`createJob did not return jobId: ${JSON.stringify(createResult)}`);
  pass(`createJob returned ${jobId}`);

  const getJobResult = await callCallable("getJob", { jobId });
  if (!getJobResult?.job) fail(`getJob returned empty job result: ${JSON.stringify(getJobResult)}`);
  pass(`getJob returned ${JSON.stringify(getJobResult.job)}`);

  console.log("[PASS] URAI Jobs Runtime production smoke submitted and getJob callable responded.");
  console.log("[INFO] Confirm worker terminal state and artifacts in Firebase/GCS dashboards for job:", jobId);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
