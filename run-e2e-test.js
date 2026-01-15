const axios = require('axios');
const { execSync } = require('child_process');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'urai-jobs-test';
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const CREATE_JOB_URL = `http://127.0.0.1:5001/${PROJECT_ID}/us-central1/createJob`;

const JOB_PAYLOAD = {
  data: {
    ownerId: "test-user-123",
    type: "e2e-test-render",
    renderSpec: {
      service: "asset-factory",
      endpoint: "http://asset-factory.example.com/render",
      payload: { a: 1, b: "hello" }
    },
    publishPolicy: {
      visibility: "signed",
      signedUrlTtlSec: 600
    }
  }
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const checkJobStatus = async (jobId) => {
  try {
    const url = `http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents/jobs/${jobId}`;
    const res = await axios.get(url);
    const fields = res.data.fields;
    return {
      status: fields.status.stringValue,
      artifacts: fields.artifacts?.arrayValue?.values || [],
    };
  } catch (error) {
    if (error.response?.status === 404) return { status: 'not-found' };
    throw error;
  }
};

async function main() {
  console.log('--- Starting URAI-JOBS E2E Test ---');
  try {
    execSync(`curl -v -X DELETE "http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents"`);
  } catch (e) {
    console.log('Firestore already clear.');
  }
  await delay(1000);

  const createRes = await axios.post(CREATE_JOB_URL, JOB_PAYLOAD);
  const { jobId } = createRes.data.result;
  console.log(`Job created with ID: ${jobId}`);

  let finalStatus = '';
  for (let i = 0; i < 15; i++) {
    await delay(1000);
    const { status, artifacts } = await checkJobStatus(jobId);
    console.log(`Current status: ${status}`);
    if (status === 'published') {
      finalStatus = status;
      if (artifacts.length > 0) {
        const artifact = artifacts[0].mapValue.fields;
        if (artifact.gsUri.stringValue.startsWith('gs://') && artifact.signedUrl.stringValue.includes('Signature=')) {
          console.log('✅ Artifacts verified.');
          break;
        }
      }
    } else if (status === 'error') {
      throw new Error('Job transitioned to error state.');
    }
  }

  if (finalStatus !== 'published') {
    throw new Error(`Job did not reach 'published' state. Final status: ${finalStatus}`);
  }
  console.log('--- E2E TEST PASSED ---');
}

main().catch(err => {
  console.error('E2E TEST FAILED:', err.message);
  process.exit(1);
});
