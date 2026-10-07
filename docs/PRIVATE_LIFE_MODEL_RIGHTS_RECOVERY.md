# Protected owner data-rights recovery

This focused successor preserves Jobs #154's protected `urai-private-source-receipt-v2` authority and #159's graph/response contracts at `ae114af4709c250d95294e10ba4d2e2876d1c547`. Neither source handler is replaced. Source execution remains disabled by default; provider activation, private-source truth, owner evidence review, deployment and release admission remain separate requirements.

## Execution authority

The existing authenticated admin/operator callable still requires the exact explicitly admitted protected-staging project, rejects production authorization and requires a stored `APPROVED` request for initial execution. A request body cannot supply an owner, operation, approval or raw source data. Its retention decision reference is bound to that stored request's owner/operation, staging admission and idempotency key; this change does not create, approve or certify a retention decision.

Each execution reserves a 180-second token and records its input digest before work. Identical active calls return `unavailable`. Failed or expired interrupted attempts can continue only with the same bound authority, current `IN_REVIEW` execution state and a three-attempt maximum. Unbound legacy audits, changed owner/operation/retention references, revoked approval, malformed retained receipts and exhausted budgets require explicit reconciliation. No older source/audit is relabeled as current proof.

Every destructive stage checks the current token. Success/failure updates are transactional: an expired predecessor cannot overwrite a successor's result or revive a denied request. Attempt histories retain original input digests and opaque export object keys. Result digests sort map keys lexically. Private transcripts/claims and arbitrary Storage/database error text are excluded from execution replies and failure audit messages.

Private exports use a separate object key per attempt under the existing owned prefix, so a delayed upload cannot replace a successor artifact. Failed or stale attempts remove only their own exact private-bucket object. Failed cleanup retains the original attempt key and marks reconciliation required; it is never a successful cleanup receipt. Protected private-bucket admission remains required before upload or cleanup. Central export delivery, retention/backup policy and cross-system deletion acknowledgement remain open dependencies.

## Owner deletion and source continuity

The existing permanent `uraiPrivateLifeModelOwnerFences/{sha256(ownerUid)}` is established transactionally before enumeration. `deletionEpoch` advances once from the prior live epoch, then remains stable through retries. Existing permanent fences without an epoch adopt epoch 1. Do not remove or reset a fence to revive a deleted source; this successor adds no re-admission action.

Owned source/index roots and children are erased in pages of at most 500 records, with 20 pages per bounded stage. Explicit exhaustion leaves the owner fence closed and remaining owned records available for continuation. Foreign-owner children fail closed and remain preserved. Job log cleanup uses separate 400-write pages before queue deletion/anonymization. Owned jobs are processed in 100-record pages, at most 2,000 per attempt, then continue through the same approved retry without retaining a mutable cursor. This avoids both the previous 500-log cap and a 501-write batch. Original source-media storage and external provider erasure stay outside this contributor's ownership.

Exports require a current owner deletion epoch before and after enumeration. Restored old source/transcript/extraction rows cannot be delivered after deletion. Protected source receipts must retain their exact document/ref/owner identity; quarantined revisions must reference an owned protected receipt and matching source-handle lineage. Historical revisions remain unreviewed source derivatives and do not become accepted historical facts. Legacy ownerless records remain explicitly unresolved.

Jobs finalization independently pins result owner/job/purpose/receipt, current canonical source consent, source fixity/revision and transcript/provenance refs. This closes substitutions after producer validation without promoting hypotheses or bypassing the owner-review importer.

## Actual checks

`npm run privacy:private-life-model:recovery` loads the actual TypeScript data-rights callable, its real role wrapper and private-source helper with memory-only Firestore/Storage doubles. Fictional fixtures cover interrupted/stale attempts, changed/revoked authority, private exports, current receipt lineage, deletion epochs, restored records, 34 cases including more than 2,000 roots and jobs, 10,001 child records with retry continuation, 499/602 logs, foreign-owner preservation and explicit cleanup reconciliation. It performs no network/provider/private-media operation.

Run the full frozen-lockfile Node 22 repository checks for the exact final SHA. Existing source-authority, graph, provider response, reconstruction and CI checks remain necessary. Passing these source tests is not private runtime, real media, IAM, device, semantic truth, production or independent-review evidence.
