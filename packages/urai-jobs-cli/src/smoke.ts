import { JobEngine } from './index';

async function smokeTest() {
  const engine = new JobEngine();

  console.log('Enqueuing test job...');
  const job = await engine.enqueue('test', { message: 'Hello, world!' }, { idempotencyKey: 'test-key' });
  console.log('Job enqueued:', job);

  console.log('Waiting for job to complete...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  const completedJob = await engine.getJob(job.id);
  console.log('Job status:', completedJob.status);

  if (completedJob.status === 'succeeded') {
    console.log('Smoke test PASSED');
  } else {
    console.log('Smoke test FAILED');
    process.exit(1);
  }
}

smokeTest();
