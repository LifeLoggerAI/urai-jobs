# R1733 — private-output broker acceptance contract (review-only)

**Status:** synthetic protocol model. NOT A SERVICE, NOT AUTHENTICATION, NOT STORAGE IAM, NOT DEPLOYED.

The current R1732 worker fails closed with `private_output_broker_required`. This contract does not change that behavior or register `life-movie.render`.

## Required invariant before implementation/promotion

1. **Admission:** Only an authenticated owner/tenant/purpose-bound caller with a current revocation epoch and a fresh, single-use, cryptographically bound reservation may initiate a broker upload. No direct Studio GCS creator permissions.
2. **Atomic fence:** Revocation advances durable, linearizable state before acknowledgment. An upload not admitted before that fence is denied. Regrant cannot reactivate a reservation or writer from an earlier epoch.
3. **In-flight drain:** Before deletion ACK, the broker must prove every outstanding upload session terminated at the provider, including resumable uploads and stale retries. A timeout, process exit, or canceled client stream is NOT proof of provider termination.
4. **Generation-bounded cleanup:** A provider-sourced generation inventory and matched generation deletion/absence verification are required. A write or regenerated object after ACK must fail. Failed or missing evidence means no ACK.
5. **Authentication and audit:** Pin Google-issued workload audience, issuer, subject/service account, owner/tenant mapping and project; do not trust client-provided proof booleans. Record consent event, epoch, reservation, provider session, object generation, IAM decision, and independent reviewer signatures without disclosing tokens or customer media.
6. **Cloud negative acceptance:** In an explicitly authorized isolated canary, demonstrate old writer, alternate writer, stale token, wrong tenant, outstanding resumable session, and post-ACK retry all denied by real GCS IAM, with signed receipts. Preserve existing owner-wide deletion fences and fail-closed behavior.
7. **Release:** No private output enablement until independent privacy/security and source review, protected CI, source-attested staging, owner-authorized purpose, and separate founder GO.

The in-memory model `private-output-broker-protocol.mjs` has no auth, external persistence, IAM, GCS API, trust root, or production wiring. Its simulated `providerSessionTerminated`, `generationDeletedOrNeverCreated` and `objectAbsentVerified` flags are **untrusted fixture values**. Passing its tests demonstrates state-machine expectations only, never provider enforcement. The model has no positive media output and must not be promoted as a broker implementation.

Related draft lineage: [R1731 red regression](https://github.com/LifeLoggerAI/urai-jobs/pull/541) → [R1732 fail-closed worker](https://github.com/LifeLoggerAI/urai-jobs/pull/542) → R1733 test-only contract.

