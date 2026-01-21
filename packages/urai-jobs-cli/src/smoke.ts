import { JobEngine } from 'urai-jobs-engine';

const engine = new JobEngine();

async function smokeTest() {
  const idempotencyKey = `smoke-${Date.now()}`;
  const job = await engine.enqueue('renderCinematic', { scene: 'test' }, { idempotencyKey });
  console.log('Enqueued job:', job);

  let status: string | undefined;
  while (status !== 'succeeded') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const updatedJob = await engine.getJob(job.id);
    status = updatedJob?.status;
    console.log(`Job status: ${status}`);
    if (status === 'failed' || status === 'deadletter') {
      throw new Error('Job failed');
    }
  }
}

smokeTest().catch(err => {
  console.error(err);
  process.exit(1);
});
