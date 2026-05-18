# URAI Jobs Per-Job-Type SLO Tracking

## Purpose

Define operational SLOs for each runtime job family so URAI Jobs can be managed as a production system-of-systems runtime.

## Core indicators

Track per job type:

- availability
- successful completion rate
- p50 execution latency
- p95 execution latency
- p99 execution latency
- retry rate
- dead-letter rate
- lease timeout rate
- artifact success rate

## Initial SLO targets

| Job type | Availability | Completion success | p95 latency | DLQ rate |
| --- | ---: | ---: | ---: | ---: |
| narrator.tts | 99.5% | 99.0% | 120s | < 0.5% |
| asset.* | 99.0% | 98.5% | 300s | < 1.0% |
| spatial.* | 98.5% | 98.0% | 600s | < 1.5% |
| studio.* | 99.0% | 98.5% | 300s | < 1.0% |

## Error budget policy

If a job type exceeds its DLQ or retry budget:

1. freeze new production rollouts for that job family
2. inspect Cloud Logging by `jobType`, `worker`, and `requestId`
3. replay safe DLQ jobs only after payload validation
4. restore rollout after 24 hours below threshold

## Required log fields

Structured logs must include:

- event
- severity
- service
- requestId
- jobId
- jobType
- retryCount
- workerName
- deploymentVersion
- environment

## Dashboard dimensions

Required breakdowns:

- job type
- worker service
- Cloud Run revision
- deploy SHA
- status
- terminal error class
