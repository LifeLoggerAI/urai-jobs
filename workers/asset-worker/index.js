const express = require('express');
const admin = require('firebase-admin');

admin.initializeApp();

const app = express();

app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  res.status(200).send({ service: 'asset-worker', ok: true });
});

app.get('/healthz', (_req, res) => {
  res.status(200).send({ ok: true });
});

app.post('/', async (req, res) => {
  const { jobId, leaseToken } = req.body;

  // 1. Authenticate request (e.g., check for a valid GCP service account token)

  // 2. Load job and verify lease
  const db = admin.firestore();
  const jobRef = db.collection('jobs').doc(jobId);
  const jobDoc = (await jobRef.get()).data();

  if (!jobDoc || jobDoc.execution.leaseToken !== leaseToken) {
    return res.status(403).send('Invalid job ID or lease token.');
  }

  // 3. Placeholder for actual work
  console.log(`Executing asset-worker for job ${jobId}`);
  
  // 4. Write back results (simplified)
  const resultId = db.collection('jobResults').doc().id;
  await db.collection('jobResults').doc(resultId).set({
    jobId,
    status: 'SUCCESS',
    //... other result fields
  });

  await jobRef.update({ status: 'SUCCESS', 'result.resultId': resultId });

  res.status(200).send({ success: true });
});

const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '0.0.0.0';
app.listen(port, host, () => {
  console.log(`asset-worker listening on ${host}:${port}`);
});
