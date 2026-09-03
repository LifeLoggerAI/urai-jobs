# URAI Jobs Observability Foundation

## Observability pillars

URAI Jobs production readiness depends on:

- metrics
- logs
- traces
- deployment telemetry
- replay auditing

## Metrics

Planned Cloud Monitoring metrics:

- jobs_created_total
- jobs_completed_total
- jobs_failed_total
- jobs_retried_total
- jobs_dead_lettered_total
- queue_depth
- worker_concurrency
- worker_saturation
- lease_recovery_total
- replay_operations_total

## Tracing

OpenTelemetry traces should propagate:

- requestId
- traceId
- parentSpanId
- deploymentVersion
- workerName
- jobId

## Structured logging

All runtime logs should be emitted as structured JSON.

Example fields:

```json
{
  "severity": "INFO",
  "event": "job.completed",
  "jobId": "01ABC",
  "jobType": "narrator.tts",
  "requestId": "req_123",
  "deploymentVersion": "sha-abcdef",
  "retryCount": 0
}
```

## Replay auditing

Every replay operation should persist:

- replay operator
- replay reason
- original failure status
- replay timestamp
- replay outcome

## Dashboards

Dashboards should include:

- queue throughput
- latency percentiles
- retry trends
- DLQ growth
- worker saturation
- deploy health
- per-job-type SLO status
