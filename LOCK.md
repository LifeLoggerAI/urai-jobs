# URAI Jobs Runtime Production Lock

**Current verdict: SOURCE IMPLEMENTED / LIVE WORKER PROOF REQUIRED**

This file applies only to `LifeLoggerAI/urai-jobs`. It does not certify the entire UrAi estate.

The Jobs runtime must not be called production locked merely because source, local tests, or fallback execution exist. The canonical worker-proof boundary in `README.md` remains authoritative: a production job is proven only when an authorized request is queued, leased, published, received by the real execution path, processed by an authenticated configured worker, persisted with a real result/artifact, and visible through retained operational evidence.

## Required production evidence

- [ ] exact release SHA recorded
- [ ] clean install, typecheck, build, unit/integration tests pass on that exact SHA
- [ ] Firebase Auth/Firestore rules and callable authorization proven
- [ ] Pub/Sub-compatible queue publication proven
- [ ] Cloud Run worker identity and authenticated invocation proven
- [ ] inline fallback confirmed disabled in staging/production
- [ ] lease, retry, idempotency, cancellation, stale reconciliation, and dead-letter behavior proven
- [ ] real result/artifact persisted with checksum/size/MIME/lineage where applicable
- [ ] operator/admin visibility and audit/log evidence retained
- [ ] monitoring/alerting for queue depth, failures, leases, dead letters, worker/provider errors established
- [ ] staging smoke retained
- [ ] production smoke retained
- [ ] rollback target and command retained
- [ ] provider credentials/worker auth proven without exposing secrets
- [ ] owner/release authorization recorded

Until every required item has current evidence, the truthful state is **not production locked**.

Historical statements that the whole ecosystem is secure, audited, or deployable are not release authority. Each UrAi subsystem must satisfy its own current exact-head and provider/runtime gates.
