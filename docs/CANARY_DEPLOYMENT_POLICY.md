# URAI Jobs Canary Deployment Policy

## Objective

Reduce production blast radius by gradually shifting traffic to new worker revisions.

## Standard rollout phases

| Phase | Traffic | Duration |
| --- | ---: | ---: |
| Phase 1 | 5% | 10 minutes |
| Phase 2 | 25% | 15 minutes |
| Phase 3 | 50% | 20 minutes |
| Phase 4 | 100% | stable |

## Rollback triggers

Automatic rollback should occur if any condition is exceeded:

- smoke verification failure
- DLQ spike > 2x baseline
- retry rate > 15%
- p95 latency regression > 40%
- Cloud Run error rate > 5%
- saturation > 90%

## Required deployment metadata

Every deployment must stamp:

- git SHA
- deploy timestamp
- environment
- worker image digest
- runtime version
- deployment actor

## Worker isolation

Canary rollout percentages should be independently configurable by:

- narrator workers
- asset workers
- studio workers
- spatial workers

## Verification flow

1. deploy revision
2. execute authenticated production smoke
3. validate worker health
4. inspect monitoring metrics
5. shift traffic incrementally
6. rollback automatically if thresholds fail
