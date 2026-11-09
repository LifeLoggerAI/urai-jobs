# R888 — erase server-owned create quota timestamps during Jobs-scoped deletion

**Date:** 2026-11-07 US Central (GitHub UTC may read 2026-11-08). **PRODUCTION HOLD / review only.** Child of the source-converged three-parent Jobs [draft PR #365](https://github.com/LifeLoggerAI/urai-jobs/pull/365), exact parent HEAD `ad2044177e3c7bf2dd695107b07c2d920f080bd9`. No deploy, permission change, paid provider, private media or peer-branch overwrite.

## Actual source finding

Jobs R887 selects only the server-owned per-user sliding-window create ledger `users/{uid}.jobsCreateRateLimit` (`functions/src/jobs/jobCreateRateLimit.ts` blob `9b7a53c41c56681dfdf4cebbc00de9a962adf5d2`). On successful transaction, `createJob.ts` updates this field with admission times while the same transaction creates job, queue, log and idempotency binding. `firestore.rules` denies client writes to `jobsCreateRateLimit`.

The existing protected Jobs deletion in `functions/src/privacy/dataRightsExecution.ts`, original blob `00cc1b9d4804099a7035dcf90ea6009bdc53098d`, checked terminal jobs and queues, atomically removed per-job logs and anonymized Jobs records, then retained central deletion request/fence on the owner. **It did not remove the newly selected Jobs-managed quota admission timestamp array**. This is a concrete omission in Jobs-scope deletion, not proof of a production data leak or complete cross-service deletion.

## Minimal, fail-closed correction

- Updated `functions/src/privacy/dataRightsExecution.ts` blob `756547684397788d8051acace70ac0e5c03e2e17` (20,242 UTF-8 bytes). The completion owner `set(..., {merge:true})` now includes `jobsCreateRateLimit: FieldValue.delete()` **after all selected Jobs are reconciled and anonymized**, while explicitly retaining `dataRightsDeletionPendingCentralPrivacy: true` and `dataRightsDeletionRequestId: requestId`. The fence is already set transactionally at deletion admission before any destructive steps; the correction does not open it.
- New original-source `scripts/r888-quota-ledger-deletion-contract.test.mjs`, blob `54ec923386f973ecae75554accf802b4c280d656`, defines **six source-based test groups**: Typescript syntax of original executor, initial approved deletion fence, terminal/anonymization-before-ledger-erasure, central fence preservation, current create admission guard ordering, and Firebase client Rules denial.
- Root `urai-jobs:verify` retains every existing R887 command and appends the R888 test; package blob `0e13c1e1c389bcdbb99938aeaa588bf08c71b589`.
- Exact-source unified runner `scripts/run-r879-unified-native-acceptance.sh` blob `d96156e331a3d2ac00432cef2195fb637a5a40ad` now includes R888 test stage and exact pins for changed privacy executor, root package and new test. **42/42 GitHub recursive-tree `check_blob` references matched**, zero mismatches, source tree `truncated=false`, **1,222 tracked file blobs, 1,439 entries**. This is source/readback evidence, not runner execution.

## Executed versus unexecuted evidence

- Connector-side inspection of the exact four source files passed **8/8 read-only source ordering/guard assertions**. These assertions are not the newly committed Node suite.
- The new six-case Node test has **not** been independently executed at current PR SHA. No exact new TypeScript parser/typecheck/full frozen install/build, Firebase Auth+Firestore+Functions+Storage e2e or production GCS IAM/data-plane test executed in this review. The container has Node v22.16, Java21, Git and global TypeScript but has **no pnpm and no DNS for github.com/registry.npmjs.org**; remote clone and frozen dependency install are blocked.
- Older 26/26 isolated peer helper tests and the 10/10 original environment fixture remain historical receipts pinned to original source blobs, not an R888 merged runtime pass.
- R888 does **not** certify deletion of user-linked idempotency bindings, protected provider artifacts, Auth account, Studio/Replay data or historical deployment identity; those need separate inventory/acceptance.

## Exact next commands (disposable clean original source)

```bash
git checkout --detach <reviewed-R888-exact-HEAD-SHA>
test -z "$(git status --porcelain --untracked-files=all)"
pnpm install --frozen-lockfile
node --test scripts/r888-quota-ledger-deletion-contract.test.mjs
pnpm urai-jobs:verify
pnpm typecheck
pnpm build
URAI_R879_ACCEPTANCE_SCOPE=DISPOSABLE_FIREBASE_EMULATORS_ONLY \
URAI_JOBS_ACCEPTANCE_SHA="$(git rev-parse HEAD)" \
bash scripts/run-r879-unified-native-acceptance.sh --run-exact-review-only
```

Capture exact source tree and lock hashes, all command exit codes/tool versions, authentic TAP and emulator logs. Add a native protected deletion test confirming quota field absent after Jobs-scope deletion while owner deletion fence/request remain, and that a concurrent create transaction cannot resurrect the field. Do not infer this from source checks alone.

**Still release HOLD:** P0 Jobs [#252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) real privileged GCS HTTP 403 after consent revocation, in-flight upload drain/no post-ACK private bytes; P1 [#337](https://github.com/LifeLoggerAI/urai-jobs/issues/337) native owner and stale operator denials; P2 [#345](https://github.com/LifeLoggerAI/urai-jobs/issues/345) real concurrent quota; positive signed owner-purpose-source consent, protected Studio MP4/SRT, Replay and production release. No production change has occurred.
