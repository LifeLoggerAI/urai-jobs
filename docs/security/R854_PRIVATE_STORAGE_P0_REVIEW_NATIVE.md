# R854 — review-only private output P0 native negative regression

Status: **DRAFT / P0 OPEN / PRODUCTION HOLD**. This is a *repeatable negative security proof*, not a production authorization, real private-movie rendering gate, deletion ACK, or IAM certification.

## Evidence lineage

- Parent exact Jobs runtime review PR #320: `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`.
- Jobs security issue [#252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) defines the missing durable post-withdrawal Storage write fence.
- Source `workers/studio-worker/private-output-write-authority.js` (parent blob `ea6b25f3949ec2c17f65a9da68fa9cf937e86e76`) **always returns false**. Do not enable it via environment flags or temporary staging overrides.
- Original `scripts/life-movies-late-write-storage-boundary.firebase-emulator.mjs` (parent blob `98b1d5e3abaa98cdeb8844a2e1c294281735c0e5`) intentionally proves that a privileged Admin Storage client can write *after* a Firestore revocation fence and an empty Storage prefix listing. It includes a warning that the emulator's generation precondition behavior cannot certify production GCS.
- The original R843 independent Runpod worker reported 16/16 stages PASS for synthetic Jobs rights/deletion and Studio frozen verification (Jobs #252 [receipt](https://github.com/LifeLoggerAI/urai-jobs/issues/252#issuecomment-6702281404)). Its negative test reported `privilegedBypassObserved=true` and `storageLevelFenceVerified=false`; no affirmative Storage fence was proven.
- Privacy #236 original R842 native review-only acceptance 16/16 PASS at exact Privacy `5daa194148c1f0b157062ca09b8f1b6e629d6d29` plus parent Jobs SHA. This is a **separate** suite and cannot replace the Storage bypass proof.
- Existing Jobs controls cover review-only Firestore attempts, point-in-time generation-bound deletion, denial of private output, and offline IAM findings. Neither mock rights, Firestore transactions, nor a list of existing Storage objects guarantees that an old privileged writer cannot complete an in-flight upload.

## Native runner

Script: `scripts/run-r854-private-storage-p0-negative-native.sh`.

Prerequisites: a fresh *clean detached* checkout of the **R854 PR head SHA** under `/tmp`, Node 22, pnpm 8.15.9, Java >=21, enough temporary disk for frozen dependencies and Firebase emulator jars, network access for pinned Firebase CLI, unoccupied Auth/Firestore/Storage ports, and a capable host for the Firebase emulator. Set `HOME`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, `CLOUDSDK_CONFIG` to isolated `/tmp` directories. Do not provide Google credentials, inherited emulator host overrides, production project IDs or real media. Use the tested project's **disposable** `urai-staging-test` local emulators only.

Example (execute *inside the clean R854 checkout*; supply the reviewed PR SHA explicitly):

```bash
set -e
nvm use 22
export COREPACK_HOME=/tmp/urai-r854-corepack
export COREPACK_ENABLE_PROJECT_SPEC=0
export COREPACK_DEFAULT_TO_LATEST=0
# Provision pnpm@8.15.9 beforehand if not already installed.
export HOME=/tmp/urai-r854-home
export XDG_CACHE_HOME="$HOME/.cache"
export XDG_CONFIG_HOME="$HOME/.config"
export CLOUDSDK_CONFIG="$HOME/.config/gcloud"
export GCE_METADATA_HOST=127.0.0.1:9
mkdir -p "$XDG_CACHE_HOME" "$CLOUDSDK_CONFIG"
export URAI_JOBS_ACCEPTANCE_SHA="$(git rev-parse HEAD)"
bash scripts/run-r854-private-storage-p0-negative-native.sh
```

The SHA variable is an execution convenience only: the **reviewer must first independently compare** the checked-out SHA to the pinned PR head rather than treating `git rev-parse HEAD` as external trust. The original runner rejects a dirty checkout, forbidden credentials/buckets and unexpected project selection before starting dependency installation.

The wrapper executes *existing* direct-write hard-off tests and review-only race-model tests, original frozen `pnpm install`, full `pnpm urai-jobs:verify`, workspace typecheck/build, then the original Firebase Auth/Firestore/Storage emulator owner-rights, write-reservation, deliberate late-write and derivative-revocation suites. No fake endpoint or simulated replacement of these tests is permitted.

## Required **negative** receipt

All original stage exits must be zero, and original named native markers must appear. The final wrapper line is:

```text
URAI_R854_PRIVATE_STORAGE_P0_NEGATIVE_REPRODUCED jobs=<exact-40-char-SHA> privilegedBypassObserved=true storageLevelFenceVerified=false productionAuthorized=false deletionAck=false
```

The word `REPRODUCED` records an **unsafe privileged Storage bypass**. It does **not** mean the gap is fixed. If any stage fails, preserve `URAI_R854_STAGE_FAIL` with exact log SHA256 and stop. The runner never prints a production GO marker. This new runner must be executed at its exact new PR head before claiming a verified R854 run; source readback or syntax inspection alone is not execution.

## Actual #252 closure criteria — none waived by this review runner

1. **One durable authorized writer:** a scoped broker or equivalent enforcement with verified current owner/tenant/project/source/purpose/rights epoch; old direct Studio/Admin writers must no longer have effective Storage write ability, including through alternate service accounts, inherited IAM, impersonation, signed URLs and approved alternate buckets. Verify on GCS data plane, not only in offline IAM snapshots.
2. **Revocation before any new bytes:** monotonic owner/purpose epoch; transactionally block new reservations before publishing revocation and stop all old attempts from starting or finalizing. An already-open stream or resumable session cannot silently finish post-ACK.
3. **In-flight reconciliation and deletion:** track every attempt durably before its first byte; drain or safely invalidate each active attempt; compare real object generations across all authorized buckets, delete only exact attributed generations, detect unattributed objects and stale replacements, require independently reviewed real GCS absence and drain receipts before acknowledging completion.
4. **Delivery-side denial:** signed workload/owner identity, active current consent+rights checked at every private MP4/SRT/manifest/Replay request, including post-withdrawal requests and cached/signed links. No public or reusable grant.
5. **Proof and approval:** exact-source native regression, storage-level post-revocation **403** against every historical/alternate writer, paused-upload race tests and independent effective IAM review. Separate protected staging production-equivalent tests and owner-authorized release/rollback procedures before any production change.

**Current release decision:** #252 **P0 OPEN**. Private output write interlock **hard-OFF**, direct Studio worker deployment hard-OFF; production private rendering and deletion completion ACK **DENIED**. R837/R842/Jobs/Studio previous passes remain valid only at their own exact commits and actual test scopes.
