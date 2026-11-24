# R1734 — Firestore-backed admission, epoch and drain review (NOT a production broker)

**Status:** review-only, isolated Firebase/Firestore emulator. The R1732 worker's `private_output_broker_required` denial remains unchanged. No GCS writes, private media, production deployment, credential usage, IAM or consent-purpose grant.

## Exact tested scope

- `firestore-broker-admission-review.mjs`: injected Firestore client; durable *emulator* document per tenant with owner/tenant binding, single-use upload reservations, atomic transaction checks, epoch-scoped commit/fence/drain/ack/regrant transitions, and denial of stale-epoch writes.
- `firestore-broker-admission-review.test.mjs`: 18 tests including two concurrent transaction races, cross-instance state persistence, wrong owner/tenant, replay, unverified provider evidence, outstanding sessions, revocation acknowledgment and regrant. **These are deterministic/test-asserted model states, not proof of real provider deletion.**
- `firebase.r1734.json` and `firestore.r1734.rules`: localhost-only Firestore emulator on 127.0.0.1:18180, temporary project ID `urai-r1734-disposable`, Security Rules deny **all client reads/writes**; privileged synthetic Admin test server can use the emulator. An unauthenticated REST client receives 403 for both read and write.
- No production source/module imports this review model. Existing worker fail-closed guard remains unchanged.

## Critical unclosed gaps

1. **Provider evidence is untrusted.** The review adapter injects a fake `verifyProviderEvidence` callback to test ACK ordering. This callback is not pinned to Google, cryptographically verified, audit-signed, or durable. Caller-controlled `authentic:true` can never be accepted by a real broker.
2. **No GCS IAM enforcement.** No broker-only `storage.objects.create` policy, no real old-principal/alternate-writer 403, no Google-issued service bearer or scoped owner-purpose consent.
3. **No real session drain or generation-bound delete.** Actual resumable upload termination, provider generation inventory, post-ACK object absence, and retry denial must be independently certified on an explicitly authorized canary.
4. **Not a scalable production schema.** One tenant document and a maximum of 128 reservations exist solely to exercise transaction ordering; a production architecture requires throughput/TTL/retention/cross-region recovery, complete audit, transaction idempotency and independent security analysis.
5. **No signed Privacy ACK or downstream lifecycle.** The model returns a local simulated status only and cannot certify deletion or create positive private renders.
6. **Environment proof:** Runpod existing pod, only localhost Firebase emulator, Google credentials unset, deny-all client rules compiled, emulator ports closed after tests. No customer data or provider writes.

## Required next acceptance

Independently review the real service architecture, implement authenticated/persistent broker and provider-trusted evidence, then prove controlled real GCS negative stale/alternate/resumable writer tests, confirmed live IAM policy/incident closure, and current-source protected CI/staging with explicit owner GO. Do not merge these review-only files into production or turn on private-memory writes without those approvals.

**Release: HOLD/NO-GO. Private-memory writes: OFF.**

