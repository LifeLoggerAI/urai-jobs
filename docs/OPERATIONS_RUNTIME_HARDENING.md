# URAI Jobs Runtime Hardening

## Implemented

- Structured JSON runtime logging
- Correlation/request IDs
- Async Express wrapper
- Centralized runtime error middleware
- Runtime metric emission
- GitHub Actions production verification gate
- Startup environment validation hooks

## Pending Infrastructure Work

### Dead-letter queue lifecycle

Recommended:

- failed jobs collection
- retry exhaustion routing
- replay tooling
- alerting on DLQ growth

### Cloud Monitoring metrics

Recommended metrics:

- job_execution_duration_ms
- job_execution_failures_total
- retry_attempts_total
- queue_depth
- lease_reclaim_total

### Saturation alerts

Recommended alerts:

- queue latency
- worker concurrency saturation
- DLQ growth
- repeated retry storms
- Cloud Run CPU saturation
- memory pressure

### Automatic production verification after deploy

Recommended:

- deploy -> prod smoke -> rollback gate
- release SHA verification
- authenticated callable verification
- artifact existence validation
