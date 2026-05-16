# URAI Jobs Runtime Hardening Plan

## Production status

Current status after authenticated production smoke validation:

- Firebase callable authentication: PASS
- Queue leasing: PASS
- Worker execution: PASS
- Firestore persistence: PASS
- Cloud Run worker health endpoints: PASS
- Production hosting pinning: PASS

## Remaining production hardening work

### Priority 0

- Structured JSON logging
- Global Express error middleware
- Request correlation IDs
- Worker auth verification
- Retry/backoff normalization
- Dead-letter queue handling
- Secret validation at startup
- Environment validation

### Priority 1

- Cloud Monitoring dashboards
- Alert policies
- Job duration metrics
- Failure rate metrics
- Worker concurrency controls
- Queue saturation monitoring

### Priority 2

- Full CI deploy verification
- Automated rollback verification
- Chaos testing
- Load testing
- Multi-region deployment strategy

## Runtime principles

- Workers must fail fast on invalid config.
- Workers must expose deterministic health endpoints.
- Workers must emit structured logs.
- All queue transitions must be observable.
- All job mutations must be idempotent.
- Production smoke tests must remain authenticated.

## Required future implementation

### Logging

Introduce structured JSON logs:

```json
{
  "severity": "INFO",
  "worker": "narrator-worker",
  "jobId": "...",
  "leaseToken": "...",
  "event": "job_completed"
}
```

### Error middleware

Standardize Express error handling:

- request validation
- lease validation
- auth failures
- unexpected exceptions

### Metrics

Track:

- queue latency
- execution duration
- retries
- failures
- dead-letter counts

### Security

Validate required secrets during worker startup:

- OpenAI keys
- Firebase config
- GCP project config
- storage bucket config

Startup should terminate immediately if critical configuration is missing.
