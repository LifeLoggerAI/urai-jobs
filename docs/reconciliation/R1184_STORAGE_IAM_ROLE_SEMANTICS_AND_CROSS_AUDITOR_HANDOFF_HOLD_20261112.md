# ONE URAI Genesis R1184 — exact IAM role semantics correction and cross-auditor consistency (HOLD)

Date: 2026-11-12 UTC. Source parent Jobs [#494](https://github.com/LifeLoggerAI/urai-jobs/pull/494) exact `1e957d4a9207cf9e315e031db2360589c8515cbc`. All modifications are offline reviewer-only IAM classifiers and tests: no production worker, Firebase, Cloud IAM grant, credential, provider write, upload/deletion, consent toggle, app deployment or release approval.

## Evidence-backed correction

Official Google Cloud documentation (checked November 12, 2026): https://docs.cloud.google.com/iam/docs/roles-permissions/storage . **`roles/storage.editor` does not list `storage.objects.create`** but DOES grant `storage.hmacKeys.*` and bucket/control-plane mutations; it belongs in a separate privilege/credential-escalation review class. **`roles/storage.expressModeServiceInput` grants `storage.objects.create`** and belongs in direct writer-risk classification. The prior R1182 implementation was fail-closed but incorrectly categorized both as *direct writers*. This refines exact risk counts, reviewer reasons and cross-module consistency without declaring either safe.

## Review-only code changes

- `scripts/review-only/r1113-staging-writer-policy-preflight.mjs`: direct writer count now excludes Storage Editor and explicitly counts privileged control-plane bindings with reason `STORAGE_CONTROL_PLANE_ESCALATION_REQUIRES_PROVIDER_REVIEW`; Express Mode Service Input remains direct write-capable. Still fails closed.
- `scripts/review-only/studio-storage-iam-snapshot-audit.mjs`: Storage Editor is recognized as IAM credential/admin review rather than generic unknown predefined role, and Express Mode Service Input is explicitly recognized as direct create risk. Other unclassified roles, inherited policies and unknown actual effective grants still block release.
- Their corresponding test files cover separate roles, project/bucket/ancestor scopes, broker insufficiency and fail-closed non-authority.

## Required proof, no authority transfer

Run the two original test files independently at this exact commit with Node 22 in a clean isolated runtime; confirm Git blob SHA1 checks, actual pass/fail counters and exit; preserve immutable raw TAP SHA256. Static role tests do not prove live effective IAM, group/impersonation, GCS late PUT denial, upload drain, generation delete ACK, authenticated C6→Replay or independent signoff.

Do not mark Jobs P0 [#252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) green, resolve Labs exposed Runpod credential [#370](https://github.com/LifeLoggerAI/urai-labs-llc/issues/370) by assumption, or enable private writes. Sync this with [Genesis #247](https://github.com/LifeLoggerAI/urai-labs-llc/issues/247), Labs #449 and Privacy #301. A reviewer must independently verify original provider receipts and protected CI before GO.

**PRODUCTION HOLD/NO-GO — PRIVATE MEMORY/PROVIDER OUTPUT WRITES DISABLED.**