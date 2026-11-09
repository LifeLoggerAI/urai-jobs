# ONE URAI GENESIS — Jobs Firebase/GCP forensic reconciliation and permanent handoff

**Checkpoint:** 2026-11-09 UTC (source and PR inspection through approximately 06:31 UTC).  
**Project seed:** urai-jobs. **Source repo:** LifeLoggerAI/urai-jobs.  
**Verdict:** **PRODUCTION HOLD / NO-GO.** This is a documentation-only, read-only/source-backed audit, not a live GCP audit or authorization to deploy.  
**Cost posture:** $0 incremental spend. No TinyFish/browser credits, no paid RunPod, no real job, private media, secrets, production or infrastructure changes.  
**Evidence classifications:** [A] directly inspected GitHub metadata and original GitHub source; [B] directly inspected PR/worker-reported receipts, NOT independently rerun; [C] static assertions performed by this reconciliation session against GitHub-returned source; [U] not inspected or not independently verified in provider control plane.

## 0. Start here and scope

- Estate registry: [LifeLoggerAI/urai-labs-llc draft #262](https://github.com/LifeLoggerAI/urai-labs-llc/pull/262), main entrypoint [docs/estate/00_START_HERE.md](https://github.com/LifeLoggerAI/urai-labs-llc/blob/docs/genesis-estate-registry-20261106/docs/estate/00_START_HERE.md), [05_VERIFICATION_AND_EVIDENCE.md](https://github.com/LifeLoggerAI/urai-labs-llc/blob/docs/genesis-estate-registry-20261106/docs/estate/05_VERIFICATION_AND_EVIDENCE.md), [08_NEXT_WORKER_HANDOFF.md](https://github.com/LifeLoggerAI/urai-labs-llc/blob/docs/genesis-estate-registry-20261106/docs/estate/08_NEXT_WORKER_HANDOFF.md).
- Current Jobs default branch main is exact SHA **9d29be1bcd3a45a4b9a743df9c9706c00811f38b**. GitHub branch metadata returned **protected:false**. This does NOT certify effective rulesets, branch write restrictions, or an authorized release path; check each separately. [A]
- The central Firebase registry contains 23 founder-supplied project IDs with independently_audited=0 as of its original snapshot. The label urai-jobs is a discovery seed. It is **not proof of project existence, billing, IAM, apps, live APIs, or deployed revision**. [A]
- Main is substantially behind extensive **unmerged** Jobs review work. Do not equate main source, a review PR, an emulator run, deployed Functions, or consumer production acceptance. [A]
- A live Firebase Console browser read was attempted and **did not start** because the available browser connector lacked wallet credits. No live Firebase/GCP provider results were obtained. Container network git ls-remote failed with DNS resolution of github.com, so full local checkout and native verification did not run here. [U]
- Historical Drive docs were searched and selected release receipts reviewed; that is not an exhaustive Drive byte audit. The older 2024 Jobs master audit predates current source/security work and should remain historical, not overwrite present facts.

## 1. Cloud resource inventory: SOURCE CONFIGURATION versus LIVE RESOURCE

| Resource family | Direct source evidence [A/C] | Live provider state [U] |
| --- | --- | --- |
| Project and alias | .firebaserc declares default project urai-jobs. Blob b5e4aa9f41a4ba80f1524d34510c9ba8465bf801. | Project number, labels, lifecycle, billing, actual resources and IAM UNKNOWN. |
| Firebase apps / Auth / App Check | Auth emulator configured at 127.0.0.1:9099; authentication and server-side role helpers appear in Functions. | Registered app IDs, client SDK keys, effective Auth providers/tenants/users, App Check enforcement UNKNOWN. Do not access user records during metadata inventory. |
| Functions | firebase.json declares Functions source functions, runtime nodejs22, codebase default and predeploy manifest verify. functions/src/index.ts exports **27 callable, HTTPS, scheduled, Pub/Sub and Firestore-triggered names**. | Actual v1/v2 resource IDs, locations, deployed source SHA, revisions, ingress, service account, env vars, concurrency, traffic and errors UNKNOWN. |
| Firestore | firestore.rules, firestore.indexes.json with **8 composite index entries**, and source references to server-only collections. | Actual databases, collection/document counts, installed index states, deployed Rules versions and effective IAM UNKNOWN. |
| Storage | storage.rules source; client protected job/export/evidence writes explicitly denied; workers write with privileged GCS credentials outside client Rules. | Real buckets, locations, uniform ACL, object generation metadata, public access, grants, effective Rules and principal permissions UNKNOWN. |
| Hosting | firebase.json names Hosting site urai-jobs-563121397472, serving web/dist with robots noindex and SPA rewrite. | Actual site existence, deployed releases, custom domain, SSL and revision history UNKNOWN. |
| Pub/Sub | executeJob v2 subscribes to environment PUBSUB_JOB_EXECUTION_TOPIC or job-execution. Terminal publisher defaults to job-terminal-events. | Topic/subscription existence, IAM, retention, DLQs, delivery failures and regional placements UNKNOWN. |
| Scheduling | processQueueTick and retryExpiredLeases scheduled every minute; publishJobTerminalEvents every minute; legacy systemReconcile every five minutes. | Cloud Scheduler jobs and invocation history UNKNOWN. |
| Firestore triggers | onJobTerminalEvent and cleanupTerminalJobs watch jobs/{jobId} state changes. | Whether triggers deployed, retry policy, Eventarc bindings, runtime identities and event receipt history UNKNOWN. |
| Cloud Run workers | deploy-workers-approved.sh allowlist includes narrator-worker, asset-worker, studio-worker, private-source-worker, captured-reality-worker; default selector is narrator + asset. | Actual Cloud Run services, images, revisions, regions, auth policy, runtime principal and traffic UNKNOWN. |
| Cloud Tasks / Eventarc / APIs | Potentially involved services must be independently queried; no live observation or exhaustive absence proof. | Existence, quotas, API enablement and usage UNKNOWN. |
| Logs / Monitoring / Quotas | monitoring/ source and deployment/preflight scripts exist. | Logs, uptime, incident metrics, alerts, SLO, rate quotas, errors and provider billing UNKNOWN. |
| IAM / secrets / identity | Production deploy workflow references WIF provider, dedicated Functions/worker identities, required object/bucket/Firestore/Publisher permissions; older bootstrap-managed-worker-iam.sh can grant roles/storage.objectAdmin. | Actual WIF audience/conditions, service principals, bucket grants, privileged alternate writers, secret versions and audit logs UNKNOWN. Never retrieve secret values. |

**Main source collection names (NOT live counts):** users, jobs, jobs/{jobId}/logs, jobQueue, jobIdempotencyBindings, jobTerminalEventOutbox, jobConsentBlocks, jobConsentEventReceipts, dataRightsRequests and nested audit, studioLifeMovieBridgeBindings, studioLifeMovieLongformPlans, studioLifeMovieLongformBindings, studioSceneTruthReceiptBindings. Root Rules include a deny-by-default wildcard; a source reference to a collection does not mean it exists with data.

**Emulator-only configuration:** Auth 9099, Functions 5001, Firestore 8080, Hosting 5000, Storage 9199, Pub/Sub 8085, UI 4000, hub 4400 and logging 4500. No emulator was started in this session.

## 2. Source-to-deployment mapping

| Source boundary | Immutable source at main | Intended runtime / trust boundary | Actual deployment parity |
| --- | --- | --- | --- |
| Firebase identity/config | .firebaserc b5e4aa9f; firebase.json f001d513 | urai-jobs default alias / Node22 Functions and configured Hosting site | NOT VERIFIED |
| Functions entrypoint | functions/src/index.ts 8ab440758ad10ccdc40a5f2cbfaa1cc412fe3a86, 27 exports | 1st/2nd-generation callable/HTTPS/schedule/PubSub/Firestore functions | NOT VERIFIED |
| Firestore clients | firestore.rules 7dc63626c6e1a2e7b20ded280ea2dd070f16abc9; indexes 61c1bcb10a7ab570cb219d772daae27017ad8f4c | Client-denied job writes; server transaction/IAM mediation | Effective deployed Rules/indexes/IAM NOT VERIFIED |
| Storage clients | storage.rules eedbbe45545ecd09d8867c9d702cd00bb3b7d7be | Client output-write denial, privileged backend bypasses client Rules | Effective Storage Rules/bucket IAM NOT VERIFIED |
| Core creation | createJob.ts 3859a209b4992d29f248eebeb338505f44e7c75e | Auth/consent/rights and atomic job + queue + log + idempotency binding | No deployed revision proof |
| Queue/worker | processQueueTick.ts, processQueueNow.ts, executeJob.ts | Scheduled leasing, manual dispatch, Pub/Sub, scoped worker HTTP | No deployed broker/worker evidence |
| Studio private render | studioLifeMovieBridge.ts, studioLifeMovieLongformBridge.ts; workers/studio-worker/index.js ae09a89d80a024301ba9df41db4265216bd6eb6b | 15-second bounded short render; separate 45-minute/180-segment source contract; parent/child/assembly; protected private delivery | HARD-OFF by default for longform; no positive real private media |
| Privacy/revocation | consentRevocation.ts a1e042b04ce5b9f9223f4c8b64b92924fc75db92; lifeMovieDerivativeRevocation.ts 3aa7bccbbc05ea27c34ac67c1d428e0220d83063 | Consent event receipt/blocks, cancellation/deletion attempts and retry safeguards | No physical post-revocation late-writer denial or purge ACK |
| Deploy governance | .github/workflows/urai-jobs-production-deploy.yml and scripts/deploy-firebase.sh, deploy-workers-approved.sh | WIF/short-lived identity, manifest, exact versions, secure service configuration | No deployed SHA, approved IAM or effective protected-CI evidence |

**Configured regions:** processQueueNow callable explicitly uses us-central1; some deploy scripts default GCP_REGION to us-central1. Do NOT assume this is an exhaustive live resource location census. **Configured bucket and identities are environment variables, not discovered actual IDs.**

## 3. Jobs lifecycle, features, and completion matrix

- **Request validation/creation — SOURCE IMPLEMENTED, NATIVE/DEPLOYMENT UNVERIFIED.** Main createJob accepts typed payloads, verifies current caller shape and consent fields, creates job, queue, log and idempotency binding in one Firestore transaction. Main rate-limit owner count is read **before** this transaction, exposing a possible concurrent-admission overshoot; issue #345 and unmerged quota-ledger reviews address it. Ownership after account/tenant transfer requires the current-owner review successors.
- **12 configured active runtime job types — SOURCE INVENTORIED, not 12 live services:** narrator.tts; asset-render; asset.render; studio.render.video; studio.assemble.video; communications.message.send; memory.private-source.transcribe; memory.private-source.index; memory.private-source.reconstruct-place; web.search; web.fetch; web.agent. Source registry marks some external provider families hard-off; no provider run occurred here.
- **Queue, lease, retry, reconcile, DLQ — SOURCE IMPLEMENTED; race/identity/native acceptance partial.** Scheduled queue tick, manual queue callable, Pub/Sub executor, expired lease retry, system reconcile, terminal event outbox and triggers exist. New review branches add current operator/owner transaction authority and retirement of legacy privileged CLI entrypoints. No live queue was read or changed.
- **Short Studio Life Movie render — SOURCE IMPLEMENTED; consent, SceneTruth and private artifact contracts exist; actual signed positive render/Replay unverified.** Worker main has two direct bucket.file(...).createWriteStream call sites. Pre-write checks and in-process cleanup do not alone prove no privileged write after server-side withdrawal.
- **Long-form Life Movie — SOURCE IMPLEMENTED / HARD-OFF / CERTIFICATION OPEN.** Distinct up-to-45-minute/180 child source design and private segmentation/assembly/playback/resume/delete are in code. Enablement requires URAI_LIFE_MOVIE_LONGFORM_ENABLED=true; no evidence authorizes enabling it or raising bounded short-render limits.
- **Cancellation/idempotency/revocation — SOURCE IMPLEMENTED with review gaps.** Owner/tenant/org and idempotency work spans draft #368/#369/#371; exact-head native acceptance remains incomplete. New test harness #378 still has one incorrect positive fixture and no full original suite pass.
- **Data-rights export/delete — SOURCE IMPLEMENTED, review-only safety gate.** Draft #373 rechecks the current operator within admission transaction. Draft #377 R900 reproduces continuation of admitted asynchronous effects after operator state changes. This is a security-policy/authorization continuity question, not proof all post-admission deletion must stop.
- **Private delivery and Replay — SOURCE CONTRACTS EXIST; authenticated multi-service real runtime and post-revoke signed URL/cache denial unverified.**
- **Deployed operations — NOT CERTIFIED.** Cloud service inventory, live executions, GCS generation receipts, billing and customer media safety cannot be asserted.

## 4. Security and privacy findings (do not falsely mark PASS)

| Priority | Exact evidence | Required closure |
| --- | --- | --- |
| P0 — Storage post-revocation future-write and in-flight drain | [Jobs issue #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) OPEN; worker main direct privileged GCS writes; source Rules only govern client SDK. Draft [#331](https://github.com/LifeLoggerAI/urai-jobs/pull/331) is NOT live IAM proof. | Broker-only/sole-writer enforcement or equivalent storage-level fence; old and alternate privileged identities demonstrably denied by real GCS 403 after revocation; in-flight reservation drain, exact-generation cleanup and final purge ACK; protected independent review. |
| P0 — signed positive C6 to protected owner playback and deletion | Master registry and Jobs issue #129; synthetic/negative work only. | Independent authenticated consent issuer, verified owner/source rights, private MP4/SRT render, protected Spatial Replay, revocation/retry/late-write denial and downstream deletion ACK, no public media escape. |
| P1 — stale operator token roles and current owner/org | [Jobs issue #337](https://github.com/LifeLoggerAI/urai-jobs/issues/337), drafts #359/#362/#371. Main legacy admin/get/cancel callables did not uniformly re-read current server role. | Converge all callables, retry and worker admission with latest server-owned state inside correct transactions; native negative tests and independent review. |
| P1 — post-admission data-rights actor revocation | [Jobs issue #376](https://github.com/LifeLoggerAI/urai-jobs/issues/376), [PR #377](https://github.com/LifeLoggerAI/urai-jobs/pull/377). | Privacy/legal steward decides durable authorized continuation versus cancellation/reconciliation; bind approval epoch, actor/service authority, recipient/owner-only export and effects/final receipts; then native tests. |
| P1 — native full integration and approvals | [#371](https://github.com/LifeLoggerAI/urai-jobs/pull/371), [#374](https://github.com/LifeLoggerAI/urai-jobs/pull/374), [#378](https://github.com/LifeLoggerAI/urai-jobs/pull/378); CI failures before steps. | Full exact-head original suite, actual native Auth/Firestore/Functions/Storage emulators, protected CI + independent reviewer; no inherited older green. |
| P1 — release governance | GitHub main branch read showed protected:false; current runs show failures before executable job steps. | Set/verify appropriate branch protection or rulesets under authorized administrator and recover CI without bypass; independent signoff and rollback proof. |
| P2 — concurrent createJob quota overshoot | Main createJob.ts pre-transaction rate read; [#345](https://github.com/LifeLoggerAI/urai-jobs/issues/345), draft quota ledger #361/#365. | Reproduce 14-way concurrency in actual disposable emulators; validate atomic ledger/legacy index, idempotency and deletion of owner-derived timestamps; production behavior remains hard-off. |
| P2 — review test/fixture divergence | [#378 R940](https://github.com/LifeLoggerAI/urai-jobs/pull/378), 13/14 targeted idempotency tests. | Fix only the positive synthetic fixture to contain the actual owner/org-bound persisted plan, add separate missing-plan zero-write denial, then rerun entire original suite. |
| P2 — cloud observability / IAM drift unknown | No live provider readback. Historical bootstrap script supports objectAdmin. | Inventory actual principals, all service revisions, audit logs, object metadata/retention, quotas/billing, planned versus effective policies, before any production promotion. |
| P3 — historical source documentation drift | Older URAI-JOBS-FIREBASE-MASTER-AUDIT-INVENTORY.md and URAI_JOBS_CURRENT_STATUS.md predate newer Rules/worker code. | Retain as dated provenance; add explicit superseded-by pointer, no destructive rewriting of historical conclusions. |

## 5. Actual test receipts and reconciled worker lineage

**A static rule inspection is NOT an emulator test. A reported passing adversarial diagnostic is NOT passing the underlying safety requirement.**

| Checkpoint / source | What previous worker receipts say [B] | What remains |
| --- | --- | --- |
| [#320 R832/R843](https://github.com/LifeLoggerAI/urai-jobs/pull/320) ea8f0165ac74511a4e4196919ddd3109d0c1ff2e | Clean Node22/pnpm8 frozen install, full verification **695 TAP cases PASS**, typecheck and build; master ledger links previous 16/16 native-review stages and Storage bypass-negative diagnostics on this older head. | Not portable current-head production acceptance. |
| [#331 R871](https://github.com/LifeLoggerAI/urai-jobs/pull/331) ff23ab3fe1f9f5179ecc2c7f1f3df3e0a81ff96a | Reconciles two Security workers; **19/19 offline GCS denial source tests**; explicitly says no new full frozen build/native 8-case acceptance at combined SHA. | Real GCS denial, IAM and drain open. |
| [#365–#371 R887–R923](https://github.com/LifeLoggerAI/urai-jobs/pull/371) df19633466eaebdda844569ed0d562245bd31dc6 | Source-only true two-parent convergence of current-owner/tenant/org cancellation and quota deletion; 76-command guarded acceptance planned/enrolled. | No complete passing native exact-head acceptance. |
| [#373 R898](https://github.com/LifeLoggerAI/urai-jobs/pull/373) da0f242ccf35e5e718a3a6c36d5a3009651ecdd6 | Current operator added to data-rights list/admission transaction; **21/21** focused current-caller helper synthetic PASS, no full build/emulators. | Post-admission async policy; exact-head native run. |
| [#374 R924–R929](https://github.com/LifeLoggerAI/urai-jobs/pull/374) 37a118dd46804561ead61d4df772e47328b2ecd6 | Real isolated source test attempts: R924 **9/11**; R925 **1/39**; R926/R927 **36/39**; R928 root privacy fixture **2/9**; R929 dependency preflight failed, no test started. All hold; preserved [R929 doc](https://github.com/LifeLoggerAI/urai-jobs/blob/review/chalk-r924-original-studio-transaction-fixture-repair-20261108/docs/security/R929_NATIVE_TEST_FIXTURE_FORENSICS_AND_HOLD_20261108.md). | Harness/source synchronization without weakening security; no full green. |
| [#375 R899](https://github.com/LifeLoggerAI/urai-jobs/pull/375) 3791617efc8fc9b974210ae09c18764e57670b3e | 23/23 original TypeScript listing callable with synthetic in-memory Auth/Firestore substitutes PASS. Mutation causes 13 expected failure assertions. | Real native Firebase and async effects. |
| [#377 R900](https://github.com/LifeLoggerAI/urai-jobs/pull/377) f8578ea281e818b01811aecc2fe4dfb8c3dc8203 | **12/12 diagnostic PASS** shows post-admission effects continue with simulated operator revocation. Strict expected-red: **12 PASS / 4 FAIL**, exit 1, digest 7e70ae305cc1f790a29aa8e7971bf42c9b09503ae7ce3e339f40239f34d65e9b. Do not enroll expected-red in green suite. | Durable authorization/policy and native proof. |
| [#378 R934–R940](https://github.com/LifeLoggerAI/urai-jobs/pull/378) 5881a650230c55245c87a001c58f3ebc6835196b; code checkpoint 52cac02c22cc7e19e3e3f9a81dc2bac854086d2b | Frozen install and focused smoke/resume tests reported PASS at several immutable source rounds. **Final original idempotency suite 13/14**, one positive existing-binding fixture fails longform_plan_not_found. See [R940 handoff](https://github.com/LifeLoggerAI/urai-jobs/blob/review/chalk-r934-consent-smoke-original-authority-review-20261109/docs/security/R940_NEXT_CHALK_ORIGINAL_SOURCE_TEST_RECONCILIATION_HOLD.md), test log SHA256 bdc8f76cbb048c77c1250b462029c6a85e69c1524757b172d9a22f7a51bfa06e. | Full 76-command verification, typecheck/build, four emulators, release still HOLD. |
| [Privacy #236](https://github.com/LifeLoggerAI/urai-privacy/pull/236), [Studio #179](https://github.com/LifeLoggerAI/urai-studio/pull/179), [Staging #176](https://github.com/LifeLoggerAI/urai-staging/pull/176), [Spatial #2069](https://github.com/LifeLoggerAI/urai-spatial/pull/2069) | Cross-worker registry documents specific prior disposable/emulated and local transport checks, incl Privacy→Jobs negative and Studio HTTP double. | Exact-head current cross-service positive signed owner→private Replay→deletion remains unverified. These branches are review-only/unmerged. |

**Current hosted CI inspection [A]:**
- Jobs #378 exact head 5881a650... [CI run 42573320186](https://github.com/LifeLoggerAI/urai-jobs/actions/runs/42573320186): completed/failure in ~3 s; build job 129015426972 has **zero recorded steps**, job logs unavailable through connector. Additional associated workflows fail. No evidence code assertions ran.
- Jobs #377 exact head f8578ea... [Runtime CI run 42570462765](https://github.com/LifeLoggerAI/urai-jobs/actions/runs/42570462765): failed before recorded Validate runtime steps; dependent Callable emulator E2E skipped. Log download unavailable. Do not label this a compiler/test regression without runner telemetry.
- Prior remote tests are reports from earlier workers, not newly rerun in this session.

## 6. Verification executed by this audit session [A/C]

1. Connected GitHub repo metadata, main commit/branch protection, registry #262 and latest Jobs/Privacy/Studio/Staging/Spatial PR metadata inspected.
2. Main Firebase configuration, Rules, index list, Functions exports, runtime registry, createJob.ts, worker GCS write sites and Life Movie hard-off source inspected at immutable main.
3. Static source checks actually evaluated: default alias urai-jobs **true**; Node22 configured **true**; Firestore job write client denial **true**; queue client deny **true**; Firestore wildcard deny **true**; Storage job client write deny **true**; Storage wildcard deny **true**; **8 configured** composite Firestore indexes; **27 exported** Functions names; **12 registry** types; pre-transaction createJob rate query **observed**; **2** direct worker Storage write call sites **observed**; long-form flag check **observed**.
4. GitHub workflow API returned failure runs and empty job steps; log retrieval attempted and unavailable.
5. Google Drive search and selected earlier historical release/authorization receipt reads performed; historical context does not supersede current source.
6. Live Firebase browser metadata audit could **not start** due no TinyFish credits. Local full clone attempt failed **git: could not resolve host github.com** (exit 128). No authenticated GCP API access, no native original code execution, no emulator process, no user data read, no billing/IAM mutation. **This session has not independently executed the 695, 76-command, 23/23, 12/12 or 13/14 historical suites.**
7. Persistent review-only GitHub handoff created from exact main commit, with no peer branch rewrite and no production source changes.

## 7. Exact next verification commands — safe progression, NOT performed here

**Stage A: source-only, uncredentialed isolated checkout** (requires an environment with working GitHub/package connectivity; use full immutable source and save stdout, stderr, exit code and SHA256 digest):

    git clone https://github.com/LifeLoggerAI/urai-jobs.git urai-jobs-audit
    cd urai-jobs-audit
    git fetch origin
    git checkout 5881a650230c55245c87a001c58f3ebc6835196b
    git rev-parse HEAD
    git status --porcelain
    node --version                    # requires Node 22
    pnpm --version                    # requires pnpm 8.15.9
    pnpm install --frozen-lockfile
    node --test scripts/life-movies-idempotency-revocation-race-contract.mjs
    node --test scripts/life-movies-longform-resume-transaction-contract.mjs scripts/r417-original-donor-longform-resume-transaction-contract.mjs
    node scripts/life-movies-consent-gate-smoke.mjs
    pnpm urai-jobs:verify
    pnpm typecheck
    pnpm build

The immutable #378 head is **expected to fail the 14-case idempotency fixture** until faithfully corrected. Do not silently bypass it. On a separately reviewed corrected commit, repeat all stages against that one complete HEAD. Never treat source-only PASS as Firebase native execution.

**Stage B: guarded disposable emulators only, no inherited production variables** (requires full source, locally installed Firebase tooling and Java, a clean detached/isolated checkout, verified environment-name clearing, and reviewed test command; no live project):

    export URAI_R879_ACCEPTANCE_SCOPE=DISPOSABLE_FIREBASE_EMULATORS_ONLY
    export URAI_JOBS_ACCEPTANCE_SHA="$(git rev-parse HEAD)"
    bash scripts/run-r879-unified-native-acceptance.sh --run-exact-review-only

Read R879 runner guards before invocation. Do not use with any production credentials or live target; use its own exact-source and disposable-project safety checks. The native negative Storage bypass reproduction is **not** effective GCS IAM proof.

**Stage C: read-only cloud metadata ONLY if an authorized free/approved authenticated GCP session becomes available; never retrieve credentials, customer records or secret payloads:**

    gcloud projects describe urai-jobs --format=json
    gcloud functions list --project=urai-jobs --format=json
    gcloud run services list --project=urai-jobs --format=json
    gcloud firestore databases list --project=urai-jobs --format=json
    gcloud storage buckets list --project=urai-jobs --format=json
    gcloud pubsub topics list --project=urai-jobs --format=json
    gcloud projects get-iam-policy urai-jobs --format=json
    firebase hosting:sites:list --project urai-jobs

Also inspect all relevant regions, Cloud Scheduler/Tasks/Eventarc, effective Firebase Rules and index deployment, Auth/App Check metadata, installed service IAM and Storage bucket policies, release revision to source/manifest digest, monitoring/log metadata, quotas and billing status. Project-wide calls above are **an inspection starting point, not a complete location/revision inventory**. Explicitly record each denied API and the permission boundary. Do not execute any deploy, create, enable, delete, IAM edit, API key read or paid cloud invocation.

**Stage D: separate founder/security-approved protected staging data-plane gate (NOT APPROVED HERE):** prove actual signed source-rights/C6, sole-writer storage-level denial with stale/alternate identities, in-flight upload drain, generation-pinned deletion, authenticated Studio→Jobs render→Spatial Replay→revocation/deletion→all downstream purge ACK; protected independent signoff and rollback. No real personal memory/media or cost without separate explicit authorization.

## 8. Handoff to next Chalk / merge boundaries

1. Start with this document, its adjacent JSON checkpoint, master Labs #262 and Jobs current main. Re-fetch PR #378 before action; current head may move. Source-only review base stays main pinned 9d29be1...; **do not cherry-pick all active worker branches or silently rewrite their tests**.
2. For the immediate next Jobs test-owner task: PR #378 R940 positive idempotency binding fixture missing persisted plan. Fix the exact test-only fixture, preserve missing-plan denial and server owner/org constraints, then capture a genuine same-SHA full green root verify and build; continue guarded R879 native only after that.
3. For security owner: issue #252 is independent P0 even with every source/emulator test green. Current GCS IAM, broker-only writer and upload drain remain unproven. For Privacy/legal owner: decide authorized continuation policy for post-admission data-rights executor issue #376.
4. Cloud infrastructure owner must supply source-to-deployment mapping with project/service IDs, region, timestamps, deployed SHA, effective Rules/IAM, billing/quotas, artifacts, denial/403 receipts. This handoff does **not** claim any deployed source equality.
5. Release owner: restore protected CI/independent reviewer before deployment; retain Genesis HOLD regardless of historical component counts. A documentation PR must never be auto-merged into production authority.
6. Nothing in this handoff authorizes paid compute or TinyFish funding. $0 incremental spend.

**Final state: substantial Jobs implementation and source-test progress; live Firebase/GCP inventory incomplete; real post-revocation privileged GCS write prevention and positive authenticated cross-system private Replay unverified; NO-GO/HOLD.**
