# Runtime Runbook

Starting SHA: 9ad2137c2689e6aa936e72b0552a0a1913981714
Branch: production-lock-jobs-2026-06-30

## Local

1. Install dependencies with pnpm.
2. Run verify, typecheck, build, test, and smoke.
3. Start Firebase emulators.
4. Run callable E2E with local fallback explicitly enabled only for emulator proof.

## Staging

1. Deploy worker services.
2. Configure worker URLs, worker auth, GCS bucket, Firebase project, and Pub/Sub topic.
3. Deploy Firebase Functions, rules, indexes, and Hosting.
4. Verify worker health.
5. Verify unauthorized execution request is denied.
6. Run narrator job and collect evidence.
7. Verify retry, fail, cancel, dashboard, monitoring, and rollback.

## Production

1. Confirm staging proof is complete.
2. Confirm rollback command and current deployed version.
3. Run one minimal safe runtime job.
4. Collect the same evidence as staging.
5. Update this proof folder with final receipts.

## Emergency disable

- Remove or disable worker URL secrets to stop new worker dispatch.
- Use operator queue controls only for safe draining.
- Use rollback worker script for bad worker revision.
- Leave inline fallback disabled in staging/prod.
