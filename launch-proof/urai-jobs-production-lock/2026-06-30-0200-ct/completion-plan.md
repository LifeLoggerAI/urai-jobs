# Completion Plan

Starting SHA: 9ad2137c2689e6aa936e72b0552a0a1913981714
Branch: production-lock-jobs-2026-06-30

1. Merge source hardening only after CI is green.
2. Run emulator lifecycle proof and attach logs.
3. Deploy staging Firebase Functions and narrator worker.
4. Configure worker auth and worker URLs in staging.
5. Prove worker health and unauthorized rejection.
6. Run staging narrator job and capture Firestore, worker log, and GCS evidence.
7. Run staging retry/fail/cancel checks.
8. Rehearse rollback.
9. Run minimal production smoke only after staging proof passes.
10. Update the proof folder with final CI/staging/production receipts.

READY is not allowed until every P0 blocker is closed with evidence.
