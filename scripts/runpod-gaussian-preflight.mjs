import fs from 'node:fs';

const policyPath = new URL('../verification/runpod-gaussian-recovery-policy.json', import.meta.url);
const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exitCode = 1;
}

function positiveNumber(name, value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    fail(`${name} must be a positive finite number`);
    return null;
  }
  return n;
}

function validatePolicyShape() {
  const limits = policy?.limits ?? {};
  const storage = policy?.storage ?? {};
  if (limits.maxConcurrentPaidPods !== 1) fail('maxConcurrentPaidPods must remain 1');
  if (limits.forbidParallelGpuRuns !== true) fail('parallel GPU runs must remain forbidden');
  if (limits.forbidSavingsPlanPurchase !== true) fail('savings-plan purchases must remain forbidden');
  if (storage.networkVolumeRequired !== true) fail('network volume must remain mandatory');
  if (storage.forbidContainerOnlyPersistence !== true) fail('container-only persistence must remain forbidden');
  if (policy?.recovery?.reuseExistingCheckpointBeforeRetraining !== true) fail('checkpoint reuse must remain mandatory');
  positiveNumber('maxHourlyUsd', limits.maxHourlyUsd);
  positiveNumber('maxInitialPaidRunUsd', limits.maxInitialPaidRunUsd);
  positiveNumber('maxEstimatedRunHours', limits.maxEstimatedRunHours);
  positiveNumber('autoStopIdleMinutes', limits.autoStopIdleMinutes);
}

function paidPreflight(env = process.env) {
  const ack = policy.paidExecutionGate.exactAcknowledgement;
  if (env.URAI_RUNPOD_ALLOW_PAID_EXECUTION !== ack) {
    throw new Error('paid execution remains hard-off: exact acknowledgement missing');
  }

  const volumeId = String(env.RUNPOD_NETWORK_VOLUME_ID || '').trim();
  const backupTarget = String(env.URAI_RUNPOD_OUTPUT_BACKUP_TARGET || '').trim();
  if (!volumeId) throw new Error('RUNPOD_NETWORK_VOLUME_ID is required');
  if (!backupTarget) throw new Error('URAI_RUNPOD_OUTPUT_BACKUP_TARGET is required');

  const hourly = Number(env.URAI_RUNPOD_GPU_HOURLY_USD);
  const hours = Number(env.URAI_RUNPOD_ESTIMATED_HOURS);
  const maxJob = Number(env.URAI_RUNPOD_MAX_JOB_USD);

  for (const [name, value] of [['URAI_RUNPOD_GPU_HOURLY_USD', hourly], ['URAI_RUNPOD_ESTIMATED_HOURS', hours], ['URAI_RUNPOD_MAX_JOB_USD', maxJob]]) {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive finite number`);
  }

  if (hourly > policy.limits.maxHourlyUsd) throw new Error(`GPU rate $${hourly.toFixed(4)}/hr exceeds policy cap $${policy.limits.maxHourlyUsd.toFixed(2)}/hr`);
  if (hours > policy.limits.maxEstimatedRunHours) throw new Error(`estimated ${hours}h exceeds policy cap ${policy.limits.maxEstimatedRunHours}h`);
  if (maxJob > policy.limits.maxInitialPaidRunUsd) throw new Error(`job cap $${maxJob.toFixed(2)} exceeds policy cap $${policy.limits.maxInitialPaidRunUsd.toFixed(2)}`);

  const computeEstimate = hourly * hours;
  if (computeEstimate > maxJob + 1e-9) throw new Error(`estimated compute $${computeEstimate.toFixed(2)} exceeds declared job cap $${maxJob.toFixed(2)}`);
  if (computeEstimate > policy.limits.maxInitialPaidRunUsd + 1e-9) throw new Error(`estimated compute $${computeEstimate.toFixed(2)} exceeds absolute initial-run cap`);

  return { hourly, hours, maxJob, computeEstimate, volumeId, backupTarget };
}

function selfTest() {
  validatePolicyShape();
  if (process.exitCode) return;

  const base = {
    URAI_RUNPOD_ALLOW_PAID_EXECUTION: policy.paidExecutionGate.exactAcknowledgement,
    RUNPOD_NETWORK_VOLUME_ID: 'test-volume',
    URAI_RUNPOD_OUTPUT_BACKUP_TARGET: 'test-backup',
    URAI_RUNPOD_GPU_HOURLY_USD: String(Math.min(1, policy.limits.maxHourlyUsd)),
    URAI_RUNPOD_ESTIMATED_HOURS: '1',
    URAI_RUNPOD_MAX_JOB_USD: String(policy.limits.maxInitialPaidRunUsd),
  };

  paidPreflight(base);

  const denied = [
    [{...base, URAI_RUNPOD_ALLOW_PAID_EXECUTION: ''}, 'acknowledgement'],
    [{...base, RUNPOD_NETWORK_VOLUME_ID: ''}, 'network volume'],
    [{...base, URAI_RUNPOD_GPU_HOURLY_USD: String(policy.limits.maxHourlyUsd + 0.01)}, 'hourly cap'],
    [{...base, URAI_RUNPOD_ESTIMATED_HOURS: String(policy.limits.maxEstimatedRunHours + 0.01)}, 'time cap'],
    [{...base, URAI_RUNPOD_MAX_JOB_USD: String(policy.limits.maxInitialPaidRunUsd + 0.01)}, 'job cap'],
  ];

  for (const [env, label] of denied) {
    let rejected = false;
    try { paidPreflight(env); } catch { rejected = true; }
    if (!rejected) fail(`self-test failed to reject ${label}`);
  }

  if (!process.exitCode) console.log('[PASS] RunPod Gaussian recovery policy is fail-closed and spend-bounded');
}

validatePolicyShape();

if (process.argv.includes('--self-test')) {
  selfTest();
} else {
  if (process.exitCode) process.exit(process.exitCode);
  try {
    const result = paidPreflight(process.env);
    console.log(JSON.stringify({
      ok: true,
      classification: policy.classification,
      maxConcurrentPaidPods: policy.limits.maxConcurrentPaidPods,
      networkVolumeRequired: policy.storage.networkVolumeRequired,
      estimatedComputeUsd: Number(result.computeEstimate.toFixed(4)),
      declaredMaxJobUsd: result.maxJob,
      hourlyUsd: result.hourly,
      estimatedHours: result.hours,
      checkpointReuseRequired: policy.recovery.reuseExistingCheckpointBeforeRetraining,
    }, null, 2));
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}
