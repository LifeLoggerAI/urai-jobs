# Production Smoke Proof

Starting SHA: 9ad2137c2689e6aa936e72b0552a0a1913981714
Branch: production-lock-jobs-2026-06-30

Status: NOT RUN in this pass.

Reason: production smoke must not run until staging worker health, worker auth, real artifact output, retry/fail/cancel paths, monitoring, and rollback are proven safe.

Required production proof after staging passes:

- Submit one minimal safe non-destructive `narrator.tts` job.
- Capture job doc, queue doc, logs, worker logs, GCS artifact, dashboard state, and final SUCCESS/DONE state.
- Verify no inline fallback was used.
- Verify rollback command is available before and after smoke.
