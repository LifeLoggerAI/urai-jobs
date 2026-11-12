# R1182 — Correct Storage IAM risk classification for real predefined write roles (HOLD)

Date: 2026-11-12 UTC. **Source parent:** Jobs [#491](https://github.com/LifeLoggerAI/urai-jobs/pull/491) exact `39f469254dc3e8e998f6a2ee8e5b1f2f6498dc28`.

## Why this change
The review-only staging Storage IAM policy checker in `scripts/review-only/r1113-staging-writer-policy-preflight.mjs` already fails closed on unknown roles, but it did not explicitly recognize two documented predefined roles capable of creating Cloud Storage objects: `roles/storage.editor` and `roles/storage.expressModeServiceInput`. They therefore appeared as generic `UNKNOWN_ROLE_PERMISSIONS` rather than as direct `NON_BROKER_WRITE_CAPABILITY`, making the write-capable-principal count less useful to independent IAM reviewers.

Official role references checked on Nov 12, 2026: https://docs.cloud.google.com/storage/docs/access-control/iam-roles and https://docs.cloud.google.com/iam/docs/roles-permissions/storage . This change deliberately does **not** add a rumored `roles/storage.legacyObjectWriter` role absent from the checked predefined-role list.

## Exact source change
Add just these two named roles to the review-only `WRITE` set. Add **three** regression tests: a foreign principal with either role must increment writer risk (not unknown-role count), the same roles do not constitute adequate bucket-scoped broker create+read+delete admission, and a public Express Mode grant must be flagged. No GCS network, IAM, credentials, production Studio worker, consent settings or private storage functionality is modified.

## Proof scope and next agents
- Independently run exact-source `node --test scripts/review-only/r1113-staging-writer-policy-preflight.test.mjs` and record source blob SHA1, TAP SHA256, Node version, exit code, raw sanitized log, execution location.
- Compare with upstream #491 unchanged Files/Firestore/Privacy/Studio runtime. No production import.
- This static preflight **CANNOT** certify effective IAM, inherited group roles, signed URLs, GCS identity, retire/alternate principal 403, active resumable URI draining, late PUT denial or physical generation deletion.
- Jobs [#252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) still requires real keyless provider-attested GCS storage proof, not this test. Cloud billing suspension and [Labs #370](https://github.com/LifeLoggerAI/urai-labs-llc/issues/370) credential incident remain provider blockers.
- Keep Labs [Genesis #247](https://github.com/LifeLoggerAI/urai-labs-llc/issues/247) and all worker PRs informed. Do not merge production, change IAM, enable private writes, or infer release GO.

**PRODUCTION HOLD_NO_GO. PRIVATE_MEMORY_WRITES / PROVIDER_PRIVATE_OUTPUTS DISABLED.**
