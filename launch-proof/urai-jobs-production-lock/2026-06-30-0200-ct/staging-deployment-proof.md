# Staging Deployment Proof

Starting SHA: 9ad2137c2689e6aa936e72b0552a0a1913981714
Branch: production-lock-jobs-2026-06-30

Status: BLOCKED by missing Firebase/GCP/Cloud Run runtime access in this pass.

Required staging actions:

- Deploy Firebase Functions, Firestore rules/indexes, Hosting, and Storage rules to staging.
- Deploy narrator worker to Cloud Run staging with `GCS_BUCKET_NAME` and worker auth configured.
- Configure `NARRATOR_WORKER_URL` and other needed worker URLs.
- Verify `/healthz` responds.
- Verify unauthorized worker execution call is rejected.
- Submit a small `narrator.tts` job through authorized callable.
- Capture job doc, queue doc, logs, worker logs, GCS object, and final SUCCESS/DONE state.
- Verify retry/fail/cancel paths in staging.
