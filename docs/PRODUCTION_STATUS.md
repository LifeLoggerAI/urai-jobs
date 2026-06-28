# URAI Jobs Production Status

Last updated: 2026-06-28

## Current lock status

URAI Jobs is **not production worker ready** until an operator-approved production lifecycle smoke proves a real job can be created, queued, claimed, executed by a real worker, status-updated, logged, and inspected end-to-end.

The repo now contains safer worker lifecycle guards and a local lifecycle proof harness, but that proof is local-only. Do not describe URAI Jobs as a fully live autonomous production worker system until production proof exists.

## What is deployed or previously verified

A prior successful deployment workflow run was recorded: `26189879850`.

That run verified deployment and reachability gates, including:

- launch unlock
- Google Cloud authentication
- dependency install
- local verification gates
- artifact bucket verification
- Cloud Run worker deployment
- worker URL export
- production environment precheck
- system-of-systems audit
- Firebase runtime deploy
- canonical Firebase Hosting verification
- worker reachability verification
- deployment artifact stamping

## What that prior run did not prove

Worker reachability is not lifecycle proof. The previous production callable smoke step was optional/skipped in the audited evidence, and the old smoke script did not wait for a terminal job state with logs and result inspection.

Missing proof before production-ready status:

- create a harmless production job
- verify `jobs/{jobId}` and `jobQueue/{jobId}` creation
- verify a worker claim/lease
- verify `LEASED -> RUNNING -> SUCCESS` or safe `FAILED`
- verify result/output or error persistence
- verify `jobs/{jobId}/logs` visibility
- verify duplicate terminal execution no-ops
- verify retry/failure behavior
- write a production proof artifact without secrets

## Live canonical Hosting URLs

- urai-jobs-563121397472.web.app
- urai-jobs.web.app

## Worker family status

- narrator-worker: implemented worker code, now fail-closed on missing worker auth token. Production lifecycle proof still required.
- career-worker: intentionally returns NOT_IMPLEMENTED until real execution and lifecycle proof exist.
- asset-worker: placeholder/gated; do not count as production execution.
- spatial-worker: placeholder/gated; do not count as production execution.
- studio-worker: placeholder/gated; do not count as production execution.

## Current conclusion

URAI Jobs is a deployed worker-infrastructure preview with local lifecycle proof support and stricter production guards. It is **LOCAL WORKER READY, DEPLOYMENT NEEDED** for these code changes, followed by an explicitly operator-approved production lifecycle smoke before any production-worker-ready claim.
