# ONE URAI GENESIS — R941 Jobs Firebase Rules source-field continuation

**Checkpoint:** 2026-11-09 UTC. **Status:** SOURCE-VERIFIED RISK; NATIVE FIREBASE RULES AND DEPLOYED EFFECTIVE RULES UNVERIFIED. **PRODUCTION HOLD.**  
**Cost:** $0. No paid TinyFish/RunPod, live GCP/Firebase calls, credentials, customer data, provider writes, main changes, Rules deployment, or worker changes.

## Starting state and evidence

- Parent audit and independent handoff [Jobs draft PR #379](https://github.com/LifeLoggerAI/urai-jobs/pull/379), original GitHub evidence report `docs/estate/GENESIS_JOBS_FIREBASE_RECONCILIATION_20261109.md` and JSON checkpoint.
- Original current main `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`; `firestore.rules` original blob `7dc63626c6e1a2e7b20ded280ea2dd070f16abc9`.
- R940 review [Jobs PR #378](https://github.com/LifeLoggerAI/urai-jobs/pull/378) observed source `5881a650230c55245c87a001c58f3ebc6835196b`, unmerged draft; its `firestore.rules` original blob `cfa77a8fa5e69327ab352b31450c59a036d21e38`.
- R940 `functions/src/privacy/dataRightsExecution.ts` original blob `756547684397788d8051acace70ac0e5c03e2e17`. Its Jobs DELETE branch sets `dataRightsDeletionRequestId: requestId` (around source line 213) and uses `owner.dataRightsDeletionRequestId === parsed.data.requestId` (around line 349) to reconcile request-specific deletion authorization.
- A separate, non-duplicative follow-up issue was created: [Jobs #380](https://github.com/LifeLoggerAI/urai-jobs/issues/380). No code fix or review bypass is claimed.

## Exact source Rules comparison

The main Rules `match /users/{uid}` permits `allow update` for a signed-in self-owner when `userProfileFieldsUnchanged()` is satisfied. The main predicate requires equality only for `role, orgId, permissions, disabled, uid` (the last with `.get(..., null)`). It does not protect adding, removing, or mutating `tenantId`, `accountStatus`, `deleted`, `markedForDeletion`, `dataRightsDeletionPendingCentralPrivacy`, `dataRightsDeletionRequestId`, or `jobsCreateRateLimit`. This is **source Rules behavior**: do not infer effective deployed Rules are identical.

R940 Rules add:
```
!request.resource.data.diff(resource.data).affectedKeys().hasAny([
  'role', 'orgId', 'permissions', 'disabled', 'uid',
  'tenantId', 'accountStatus', 'deleted', 'markedForDeletion',
  'dataRightsDeletionPendingCentralPrivacy', 'jobsCreateRateLimit'
])
```
The new source guard correctly denies changes/additions/removals of the listed owner authority fields, but **omits `dataRightsDeletionRequestId`**. The associated DELETE executor treats this omitted field as part of its same-request fence.

**Static evaluation actually performed** against original GitHub-returned source strings, with field differences and known protected fields: `tenantId`, `accountStatus`, `deleted`, `markedForDeletion`, `dataRightsDeletionPendingCentralPrivacy`, `jobsCreateRateLimit` = unprotected by main self-update guard / protected in R940 guard; `dataRightsDeletionRequestId` = unprotected under both; `role` = protected by both. This is not a Firebase emulator execution. The practical concern is that a signed-in owner may corrupt request-binding state and cause legitimate approved deletion to fail closed; **not** a demonstrated live authentication bypass or proof of arbitrary data deletion.

## Priority and immediate next engineering work

**P1 — user-controlled server-owned request binding / data-rights continuity (new #380).** Independently assess impact and severity after native Rules tests. Fix on an isolated review-only branch, not on the documentation branch or already active Jobs/Privacy worker branch. Explicitly protect `dataRightsDeletionRequestId` via the Rules `affectedKeys` guard. Prefer reviewing a positive allowlist of public-editable profile fields against every current and historical server-owned field, lest future fields become writable silently.

**Required native negative and positive tests:**
1. Authenticated owner attempts `dataRightsDeletionRequestId` create/change/delete -> DENY; include legacy documents with no field.
2. Owner attempts tenant/org rebind, disable/delete/account-state mutation, deletion-pending false/true toggles, or quota ledger create/change/removal -> DENY.
3. Anonymous/cross-owner attempts read/update -> DENY per intended policy. Administrator client writes to protected `users/{uid}` should NOT bypass server policy.
4. Valid user display/profile change -> ALLOW only according to reviewed schema, no full account-state overwrite.
5. Trusted Admin server transaction sets/removes request binding and persists central Privacy deletion fence; real disposable emulator verification of Jobs DELETE admission, terminal logs/queue cleanup, idempotent replay and legitimate deletion continuation.
6. Match released effective Rules version to candidate SHA and project identity via **authorized read-only GCP/Firebase control plane**. Do not deploy from this audit.

**Separate P0 remains** [Jobs issue #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252): actual privileged GCS post-revocation future-write denial and in-flight drain; also positive consent→Studio→Jobs→protected Spatial Replay→deletion/purge ACK. The Rules correction cannot close Storage IAM. Protected CI and independent approval remain blocked and no release GO is permitted.

## CI and provider evidence boundary

At handoff PR #379 source SHA `351f72848b7aab9fde87c886951f67c0645b7c6e`, GitHub latest Actions records reported multiple fast failed jobs, including [CI run 42574116947](https://github.com/LifeLoggerAI/urai-jobs/actions/runs/42574116947). This is **not** proof a Rules test executed; preserve runner job steps/logs before attributing source failure. The earlier audit's paid browser was unavailable and is not retried. Actual Firebase effective Rules/IAM, users, Cloud Run revisions, events, logs, quota, billing and storage data-plane remain **UNINSPECTED**.

## Next Chalk exact pickup

1. Read [Jobs #379](https://github.com/LifeLoggerAI/urai-jobs/pull/379) and [Jobs #380](https://github.com/LifeLoggerAI/urai-jobs/issues/380); refresh moving source and check for concurrent fixes before editing.
2. Preserve R940 [PR #378](https://github.com/LifeLoggerAI/urai-jobs/pull/378) active worker; keep its failing 13/14 idempotency fixture separate from this new Rules source finding.
3. A dedicated Rules reviewer adds owner-field denial and valid display-field allowance native Firestore emulator tests in safe disposable `demo-*` project; strict full exact-head frozen tests/build and original R879 consent/security stages remain necessary.
4. Only independently reviewed candidates can be merged via governed protected CI, and only separately authorized controlled release work can update live Firebase Rules. Production remains HOLD.

**No production mutation, no paid usage, no customer data, no release authorization.**
