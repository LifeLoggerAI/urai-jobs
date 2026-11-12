# ONE URAI R1185 — Private object-reader IAM audit gap, review-only

Date: 2026-11-12. Parent: Jobs #495 exact `8f401b9c1c2d61f761c1a83bfd90cbb3e70f5156` (draft review lineage). This branch does not modify production application permissions, IAM, private storage, customer data or release settings.

## Finding

The offline `studio-storage-iam-snapshot-audit.mjs` classifier previously recognized `roles/storage.objectViewer` and `roles/storage.legacyBucketReader` as read-only, but its `collectPolicy` findings did not explicitly call out that object-read/list capability can expose private media or metadata without object creation. The separate `r1113-staging-writer-policy-preflight.mjs` already raises confidentiality review for such roles, leaving a cross-auditor inconsistency.

## Narrow fix (not release authorization)

- Add `PRIVATE_OBJECT_READ_OR_LIST_ROLES` for `roles/storage.objectViewer`, `roles/storage.legacyBucketReader`, `roles/storage.legacyObjectReader`.
- Raise sanitized `PRIVATE_OBJECT_READ_OR_LIST_GRANT_REQUIRES_REVIEW_<SCOPE>` when an actual role binding has one or more members; apply at PROJECT, BUCKET and ANCESTOR scopes without logging principal names.
- Recognize legacyObjectReader as a reviewed *reader* classification, not an unknown role. Still block confidentiality and leave all existing hard HOLD outputs.
- Three new original-file regression tests cover non-public project+bucket viewers, ancestor legacy readers, empty member bindings and non-disclosure.

Changed source/test:
`scripts/review-only/studio-storage-iam-snapshot-audit.mjs` and `scripts/studio-storage-iam-snapshot-audit.test.mjs`.

**Test status: NOT CERTIFIED.** Run the *original* source-locked suite using Node 22 with `node --test scripts/studio-storage-iam-snapshot-audit.test.mjs`; capture exact Git commit and both blob SHA-1s, raw TAP digest, exit code and independent re-execution. The connected Runpod worker log channel has recently returned empty container logs, so an EXITED Pod alone must never be represented as a PASS. A static source review is not proof of test pass.

## Other-worker coordination

- Jobs #494/#495 must preserve the distinction: Storage Editor = privileged HMAC/control-plane review (not direct object creation); Express Mode Service Input = direct writer. This change only addresses additional read/list confidentiality alerts.
- Jobs #252 still requires real provider-effective IAM for all principal and ancestor grants, group/federation expansion, retired/alternate negative GCS 403, actual upload-session drainage, generation deletion and signed independent review.
- Labs #449 and Privacy #301 must update cross-repo candidate references after the exact source hash changes, without assuming a combined runtime test.
- Runpod incident Labs #370 must close with authenticated revocation and restricted owner/security evidence; CI support #4889576 and authenticated owner-positive lifecycle remain blocked.

**PRODUCTION HOLD_NO_GO. PRIVATE MEMORY/PROVIDER OUTPUT WRITES DISABLED.** No main merge, cloud IAM mutation, credential access, production deploy, data reads or independent GO claimed.
