import { https } from 'firebase-functions';
import { JobEngine } from 'urai-jobs-engine';

const engine = new JobEngine();

export const runJob = https.onRequest(async (req, res) => {
  const { jobId } = req.body;
  if (!jobId) {
    res.status(400).send('Missing jobId');
    return;
  }

  try {
    await engine.runJob(jobId);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error running job:', error);
    res.status(500).send('Internal Server Error');
  }
});
