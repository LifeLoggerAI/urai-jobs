# ONE URAI GENESIS — R944 Jobs P0–P3 engineering closure taskbook and no-cost verification recipes

**Owner:** Next Chalk + independent authorized Jobs, Privacy, Studio, Spatial, Cloud IAM and release reviewers. **Source:** [Jobs forensic #379](https://github.com/LifeLoggerAI/urai-jobs/pull/379). **Decision:** NO-GO/PRODUCTION HOLD.

**Do not call a task DONE because the code exists, a synthetic test passes, a test command is written, or a worker reports a PASS on a different SHA.** No new paid use, TinyFish credits, production cloud mutation, user data or real job creation is approved.

## P0 — Must close before any private media release

### P0.1. Persistent Storage-level privileged-writer revocation [issue #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252)

- **Existing:** worker code checks lease/owner consent before GCS `createWriteStream`, tracks process-local write list, generation guarded cleanup; Privacy derivative invalidation performs point-in-time list and deletions.
- **Missing:** unique broker/scope/epoch reservation before first byte; proof of old/alternate principal denial under **actual effective bucket IAM**, active-upload drain, late bytes disallowed after verified consent withdrawal, exact-generation deletion with final ACK. No signed C6 permission or data-plane acceptance.
- **Acceptance:** on approved protected nonprod scope only, record real account/service principal, bucket and prefix, request epoch and lease, GCS object metadata generation, **403** for stale/alternate principals after revocation, in-flight unrecorded writer failure or drain, final absence and authoritative durable purge ACK. Deny cache/signed URL alternate paths. Human reviewer verifies no public/private media escape.
- **No shortcut:** Firebase client `storage.rules` are not IAM controls for Admin SDK/Cloud Run. A Firestore transaction or emulator-only generation test cannot establish exclusive storage permission.
- **Owners:** Jobs worker author, Privacy security/revocation owner, GCP IAM administrator; independent reviewer.

### P0.2. Signed positive private consent/rights and protected replay

- **Existing:** Studio source envelope carries source generation/ownerOrRightsRef/consentRef, Jobs validates owner/consent/SceneTruth and supports private MP4/SRT bridge, Spatial Replay source. Longform remains hard-off (`URAI_LIFE_MOVIE_LONGFORM_ENABLED=true` required).
- **Missing:** authenticated trusted owner-issued C6, source rights validation across both services, signed service-to-service workload identity, actual protected output, original Spatial Replay decoded frames/captions and seeks, source generation checks, revocation and hard refusal on every later playback, downstream purge ACK.
- **Acceptance:** privacy approved safe non-production disposable media, verified owner and source, actual Jobs worker private MP4/SRT output, exact GCS SHA256/generation receipts, Spatial owner-only playback+denial, revoke then replay denied, delete then physically absent; dual review/founder decision.
- **Owners:** Privacy/Studio/Jobs/Spatial; no one worker can self-approve.

### P0.3. Release governance

- **Existing:** source contains WIF/OIDC workflows, signed prebuilt manifest and deployment-receipt/rollback checks.
- **Missing:** verified protected branch/checks, independent eligible review, current production live deployment revision and rollback, real private media P0 gates.
- **Current GitHub branch API:** Jobs `main protected:false`; workflows often terminate within seconds without recorded steps. Do not bypass required checks, reuse old status contexts or infer source compile failure.
- **Owners:** repository administrator, GitHub Support case #4889576, release steward.

## P1 — Security/consistency blockers before governed exact-head release

### P1.1. R940 + R943 + parallel R942 convergence

- **Existing:** [#378](https://github.com/LifeLoggerAI/urai-jobs/pull/378) R940, [#381](https://github.com/LifeLoggerAI/urai-jobs/pull/381) Rules/fence, [#382](https://github.com/LifeLoggerAI/urai-jobs/pull/382) idempotency plan fixture. All review/unmerged, and both last branches are sibling descendants of immutable `5881a650230c55245c87a001c58f3ebc6835196b`.
- **Missing:** source-integrity-preserving composite commit with BOTH disjoint fixes; verify exact donor Git blobs, overlap and all source pins; run original 15 static, genuine four-emulator Rules client ID-token 403/200 checks, all **17** original idempotency cases, full 76-command verify/build/typecheck on SAME source. Do not downgrade the original `longform_plan_not_found` safety invariant.
- **Owner:** independent source integrator and original test owners, protected reviewer.

### P1.2. Current identity and deletion safety

- [#337](https://github.com/LifeLoggerAI/urai-jobs/issues/337) old token-claim-only privileged API, source-negative 9/9 diagnostic; current owner/tenant/org server-side checks present in unmerged convergence #371 and friends. Require native transaction tests for v1/v2 list/log/retry, get/cancel/status/dispatch and nested quota, revoked admin, deleted/disabled owner, cross-org and cross-tenant, stale retries, terminal log cleanup.
- [#380](https://github.com/LifeLoggerAI/urai-jobs/issues/380) server-owned `dataRightsDeletionRequestId` client mutation gap in main and R940. #381 review guard now protects field, with locally executed original static 15/15; native authenticated client Rules mutations still NOT_RUN. Confirm Admin service write still works after Rules change; protect add/change/remove on normal and legacy profiles.
- [#376](https://github.com/LifeLoggerAI/urai-jobs/issues/376) data-rights operator role revocation **after admission**. Need binding policy from Privacy/legal steward: approved user deletion may need durable centrally-authorized continuation, not indiscriminate cancellation. R900 diagnostic 12/12 reproduces continuation; 4 expected-red requirements FAIL. Implement service epoch/fence or approved durable continuation and test partial effects, receipt finalization and owner-only delivery. No change to production without approval.

### P1.3. Genuine cross-service runtime

- Privacy→Studio→Jobs→GCS→Spatial consent/current-owner/file-generation/Replay and revocation/deletion physical ACK; all sources on one reviewed integration manifest, each exact SHA and deployed digest.
- Native four emulators for Jobs original runner, native Privacy and Staging corresponding suites (not synthetic HTTP double) and independent device/browser acceptance. Restore CI/frozen install on actual build environment.

## P2 — Reliability, engineering debt, test repairs

- [#345](https://github.com/LifeLoggerAI/urai-jobs/issues/345) main createJob rate check happens before transaction, potential concurrent over-admission. Later draft uses transaction-protected per-owner ledger and a **9th** Firestore composite index. Verify 14-way signed-in concurrent native tests, late-window transition, quota deletion, idempotency and current org. Never certify live installed index from source.
- R940 positive idempotency replay fixture missing bound stored plan; #382 added owner/tenant/source fixture and 3 explicit negatives; **7/7 focused helper PASS reported, original 17-case NOT_RUN**. Repair actual fixture failures without bypassing current plan ownership validation.
- Reconcile two job registries: `runtimeJobTypes.ts` 12 actively admitted types vs broader legacy `jobRegistry.ts` including career/spatial/etc planning keys; classify functional/live/hard-off/legacy, eliminate falsely advertised unrouteable work.
- Reconcile old CLI admin write bypass and direct worker object writing, stop retired scripts from creating unauthorized tasks.
- Verify v1/v2 function lifecycle, scheduling conflict/idempotent retry/DLQ, analytics outbox, retries, event duplicate/ordering, worker timeouts/heartbeat/cleanup, runtime errors and provider-cost boundaries.
- Compare `firebase.json` Hosting site `urai-jobs-563121397472` with `deploy-firebase.sh` default `urai-jobs`; ensure actual approved deployment uses the intended source-bound configuration.

## P3 — Operational/estate coverage

- Compare old `docs/URAI-JOBS-FIREBASE-MASTER-AUDIT-INVENTORY.md`, old Job V1–V5 matrices, older content/asset source and current canonical runtime; preserve historical context and label superseded conclusions.
- Read-only GCP project, Firebase apps/Auth/AppCheck, all Firestore DB/indices/Rules, GCS buckets/IAM, all Functions/Cloud Run revisions, Cloud Scheduler/Tasks/PubSub/Eventarc, logs/billing/monitoring, IAM actors/WIF, Hosting/domains, backups/quotas, deployment provenance. Actual resource state is still **UNKNOWN**.
- Capture screenshot/GUI evidence only from explicitly authorized free tools and never imply the Firebase console link grants access.
- Preserve handoffs in both Jobs repo #379 and master Labs registry via a **reviewed** cross-repo pointer. No silent edits to master branch.

## Verification recipes: stages, exact source, and cost boundaries

**Stage 0 — metadata, no credentials, no costs (already inspected):**

```sh
git clone https://github.com/LifeLoggerAI/urai-jobs.git jobs-verify
cd jobs-verify
git fetch origin
git checkout <INDEPENDENTLY_REVIEWED_FULL_40_CHAR_SHA>
git rev-parse HEAD
git status --porcelain --untracked-files=all
git hash-object firestore.rules scripts/owner_authority_rules.static.test.mjs scripts/user_authority_rules.firebase-emulator.test.mjs
```

Must be a complete immutable verified source tree and clean worktree. **This environment cannot clone**: `git ls-remote` returned DNS `Could not resolve host: github.com`, exit 128. Do not invent an assumed local source.

**Stage 1 — original static owner-field test (EXECUTED here at R944, on exact reconstructed three files):**

```sh
cd /mnt/data/r942_verify
node --version
git hash-object firestore.rules scripts/owner_authority_rules.static.test.mjs scripts/user_authority_rules.firebase-emulator.test.mjs
node --check scripts/user_authority_rules.firebase-emulator.test.mjs
node --test scripts/owner_authority_rules.static.test.mjs > R944_original_static_node.tap 2>&1
sha256sum R944_original_static_node.tap
```

Observed: Node 22.16.0; Git blob match on three files; Node `node --check` PASS; original static suite **15 tests, 15 PASS, zero FAIL/SKIP**, log SHA256 `3e5f5f247d7449fd805022972fde18f74367593385b2773a484cee8f3a733dcb`. This **does not run** actual Firebase Rules.

**Stage 2 — complete frozen original source + original 17-case longform and 76-root verification (NOT_RUN):**

```sh
# On authorized credential-free full checkout at independently reviewed
# composite SHA which deliberately includes BOTH Jobs #381 and #382:
node --version  # 22.x
pnpm --version  # 8.15.9
pnpm install --frozen-lockfile
node --test scripts/owner_authority_rules.static.test.mjs
node --test scripts/life-movies-idempotency-revocation-race-contract.mjs
node --test scripts/life-movies-longform-resume-transaction-contract.mjs scripts/r417-original-donor-longform-resume-transaction-contract.mjs
node scripts/life-movies-consent-gate-smoke.mjs
pnpm urai-jobs:verify
pnpm typecheck
pnpm build
```

Record exact SHA, clean checkout, package lock/frozen versions, stdout/stderr, TAP count, log SHA256, environment secrets absence and all exit codes. **Do not claim 76 PASS until all 76 commands in the canonical root suite actually execute and exit 0 on one combined SHA.**

**Stage 3 — disposable four-emulator acceptance, no production credentials (NOT_RUN):**

```sh
# On fully prepared credential-free test host, only after source pins updated
# by independent reviewer; examine runner and all preflight guards first.
export URAI_R879_ACCEPTANCE_SCOPE=DISPOSABLE_FIREBASE_EMULATORS_ONLY
export URAI_JOBS_ACCEPTANCE_SHA="$(git rev-parse HEAD)"
bash scripts/run-r879-unified-native-acceptance.sh
```

The original runner includes Firebase Tools `15.24.0`, nested project guards and exact source-pin checks, and the child `scripts/run-r879-jobs-native-auth-acceptance.sh` creates synthetic Auth/Firestore/Functions/Storage `demo-urai-jobs` emulators, requires Node22/Java21/pnpm8.15.9, checks `.env` and cloud credential absence, includes `user_authority_rules.firebase-emulator.test.mjs`. The outer Storage negative stage uses a separate disposable `urai-staging-test` context. Retain all scope hard-offs. Do not run with `GCLOUD_PROJECT=urai-jobs`, actual production secrets or credentials.

**Stage 4 — authenticated read-only GCP provider inventory (NOT_RUN):**

```sh
gcloud projects describe urai-jobs --format=json
gcloud functions list --project=urai-jobs --format=json
gcloud run services list --project=urai-jobs --format=json
gcloud firestore databases list --project=urai-jobs --format=json
gcloud storage buckets list --project=urai-jobs --format=json
gcloud pubsub topics list --project=urai-jobs --format=json
gcloud iam service-accounts list --project=urai-jobs --format=json
gcloud projects get-iam-policy urai-jobs --format=json
firebase hosting:sites:list --project urai-jobs
```

Enumerate every discovered location and relevant Scheduler/Tasks/Eventarc. Query metadata and policies **only** with previously approved authenticated access; do not retrieve secret values, Firebase user PII or Storage customer objects. This is an audit gap, not an instruction to buy access.

**Stage 5 — privileged GCS and signed end-to-end C6 acceptance (NOT_AUTHORIZED here):**

Require separate written founder/security approval and zero or explicitly capped cost. Never run with private family media or customer jobs by default. Real GCS 403/epoch, upload drain, exact-generation deletion and owner-only replay need a controlled protected staging identity; no emulator can replace provider IAM.

## STOP/GO

- **GO for review-only documentation and offline tests**.
- **HOLD for any merge into production authority, live Firebase Rules deploy, new IAM grant, paid tool invocation, public domain exposure, positive private media processing or public launch** until every P0/P1 gate is independently accepted and founder authorization recorded.
