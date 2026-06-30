# Worker Execution Proof

Starting SHA: 9ad2137c2689e6aa936e72b0552a0a1913981714
Branch: production-lock-jobs-2026-06-30

## Source evidence

- `executeJob` routes to configured worker URLs by job family.
- `executeJob` now fails missing worker URL in staging/prod instead of returning inline success.
- `executeJob` sends an auth header when `URAI_JOBS_WORKER_TOKEN` is set.
- `workers/narrator-worker` exposes `/execute-job` and now requires auth outside local/emulator mode.
- `handleNarratorTts` uses Google Text-to-Speech and writes audio to GCS when configured.

## Proof level

Source-level: present.
Local/emulator: blocked by checkout/DNS in this environment.
Staging/live: blocked by missing Firebase/GCP/Cloud Run runtime access in this pass.

## READY requirement

Run a safe narrator job in staging and capture: job doc, queue doc, logs, worker logs, real GCS object path, final result, and dashboard view.
