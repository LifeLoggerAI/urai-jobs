# Production Runtime Hardening

## Dead-letter queue lifecycle

Failed jobs should be copied into `failedJobs/{jobId}` with:

- original payload
- retry telemetry
- worker metadata
- request correlation IDs
- terminal failure reason
- timestamps

Recommended lifecycle:

1. Worker failure
2. Retry exhaustion
3. Persist failedJobs document
4. Emit Cloud Logging error event
5. Increment retry metrics
6. Trigger alert policy
7. Manual or automated replay

## Replay workflow

Dry run:

```bash
FAILED_JOB_ID=<job-id> node scripts/replay-dlq-job.mjs
```

Execute replay:

```bash
DRY_RUN=false FAILED_JOB_ID=<job-id> node scripts/replay-dlq-job.mjs
```

## Retry telemetry

Recommended metrics:

- jobs_retry_total
- jobs_dead_letter_total
- jobs_completed_total
- jobs_failure_total
- jobs_retry_exhausted_total
- jobs_processing_duration_ms

Labels:

- job_type
- worker_name
- environment
- terminal_status

## OpenTelemetry

Recommended trace attributes:

- request.id
- job.id
- worker.name
- retry.count
- lease.token
- deployment.version

## Structured Cloud Logging

All logs should include:

```json
{
  "severity": "INFO",
  "requestId": "req_x",
  "jobId": "job_x",
  "worker": "cloud-run-worker",
  "deploymentVersion": "git-sha",
  "environment": "production"
}
```

## Automated rollback

Rollback conditions:

- smoke verification failure
- worker health verification failure
- elevated saturation alert
- elevated dead-letter rate

Recommended rollback flow:

1. mark deployment unhealthy
2. halt rollout
3. restore previous Cloud Run revision
4. rerun smoke verification
5. reopen deployment gate

## Deployment artifact stamping

Every deployment should stamp:

- git SHA
- GitHub Actions run ID
- build timestamp
- environment
- deployed worker revision

Recommended env vars:

```bash
DEPLOY_GIT_SHA
DEPLOY_RUN_ID
DEPLOY_TIMESTAMP
DEPLOY_ENVIRONMENT
```

## Autoscaling safeguards

Narrator workers:

- min instances: 1
- max instances: 20
- concurrency: 1-2
- memory: high

Asset workers:

- min instances: 0
- max instances: 10
- concurrency: 2-4

Studio orchestration:

- low concurrency
- protected CPU allocation
- aggressive timeout ceilings

## Saturation alerts

Recommended alerts:

- CPU > 85%
- memory > 85%
- queue depth growth
- lease timeout spikes
- retry explosion
- dead-letter spike
- worker restart spike
