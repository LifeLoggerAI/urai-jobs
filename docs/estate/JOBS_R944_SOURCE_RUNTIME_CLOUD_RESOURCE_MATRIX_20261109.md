# ONE URAI GENESIS — R944 Jobs source, runtime topology and cloud resource audit matrix

**Audit timestamp:** 2026-11-09 UTC. **Scope:** project discovery seed `urai-jobs`, repository `LifeLoggerAI/urai-jobs`, relevant Privacy/Studio/Spatial/Staging upstream and downstream. **Verdict:** PRODUCTION HOLD / NO-GO.

**Evidence legend:** `S` = inspected exact original GitHub source at immutable commit; `P` = inspected original PR or prior worker receipt, independently not rerun; `L` = original source test actually executed locally; `U` = actual Firebase/GCP provider control/data plane unverified. **No Firebase project state is certified from a project ID, source alias, console link or configured deploy target.** No paid browser, GCP access, paid compute, production IAM/deployment, real jobs or customer media used.

## 1. Entrypoint and authoritative SHA boundaries

- [Master Genesis #262](https://github.com/LifeLoggerAI/urai-labs-llc/pull/262), `docs/estate/00_START_HERE.md`, master entry blob `e7b1d09957b354f603cbf78a507cb7a108fcd3ec`; HEAD observed `d8167bae7fa1487a62115d704165853587a277ae`. The 23 founder-supplied Firebase project IDs, including `urai-jobs`, are explicitly discovery seeds and have **zero independently audited control planes in the original registry**.
- Jobs `main` HEAD `9d29be1bcd3a45a4b9a743df9c9706c00811f38b`, branch API `protected:false`. This is source metadata and NOT deployed identity. Ruleset/admin readback requires separate permission.
- Jobs [#379](https://github.com/LifeLoggerAI/urai-jobs/pull/379): previous cloud source-forensics audit; documentation-only draft on `docs/genesis-jobs-firebase-forensics-20261109`.
- Jobs [#371](https://github.com/LifeLoggerAI/urai-jobs/pull/371): owner/consent/quota two-parent review `df19633466eaebdda844569ed0d562245bd31dc6`; not merged.
- Jobs [#378](https://github.com/LifeLoggerAI/urai-jobs/pull/378): original test-fixture review `5881a650230c55245c87a001c58f3ebc6835196b`; not merged. **Two later sibling candidates derive from THIS parent:** [#381](https://github.com/LifeLoggerAI/urai-jobs/pull/381) `a295fd834c1cc01710a36b04523b023de2283240` Rules/owner test, and [#382](https://github.com/LifeLoggerAI/urai-jobs/pull/382) `d87cc22b798b6894861a344125f57747e016c1ba` longform test fixture. Neither contains the other's correction and neither is full-system certified.
- Do not rewrite/merge these branches to make a green result; independent review and exact-head composite acceptance required.

## 2. Source-bound Firebase configuration (S)

| Source file / Git blob | Verified local configuration | Actual live status |
| --- | --- | --- |
| `.firebaserc` `b5e4aa9f41a4ba80f1524d34510c9ba8465bf801` | default Firebase project alias `urai-jobs` | **U** project number, apps, billing, permissions |
| `firebase.json` `f001d5130f4b2583c0d5030c393586180e38172e` | Functions source `functions`, runtime `nodejs22`, codebase `default`; predeploy verified prebuilt manifest; Hosting public `web/dist`, configured site `urai-jobs-563121397472`; Firestore/Storage Rules; emulators | **U** actual project, deployed SHA/functions/site |
| `firestore.rules` on main `7dc63626c6e1a2e7b20ded280ea2dd070f16abc9` | Direct clients cannot write jobs/queue/private reliability/consent/right records; `users/{uid}` self-edit guard only protects five original authority fields | **U** deployed Rules source/release |
| `firestore.rules` on review #381 `d30c3e8fbbfcbf25767501e351edcb18d6080c6d` | New 12-field `affectedKeys` guard protects `dataRightsDeletionRequestId` and earlier owner tenant/deletion/quota fields | **U** never merged/deployed |
| `firestore.indexes.json` main `61c1bcb10a7ab570cb219d772daae27017ad8f4c` | 8 configured composite indexes; `jobs`, `jobQueue`, terminal outbox, data-rights | **U** installed/index state |
| `firestore.indexes.json` review #381/#382 `7690ab3a4db2d7e83de5d6d13ebd7100cecde5bd` | 9 source indexes; adds `jobs(ownerUid ASC, createdAt ASC)` for quota/migration lineage | **U** not a live index receipt |
| `storage.rules` main/review `eedbbe45545ecd09d8867c9d702cd00bb3b7d7be` | Direct client output writes denied; owner/admin client reads scoped by path/role only; backend IAM bypasses client Rules | **U** deployed Rules, bucket IAM, late writer control |
| `functions/src/index.ts` `8ab440758ad10ccdc40a5f2cbfaa1cc412fe3a86` | Exactly 27 named exports at main | **U** existence/region/version/traffic/revision of ANY deployed function |
| `workers/studio-worker/index.js` `ae09a89d80a024301ba9df41db4265216bd6eb6b` | Express/FFmpeg source, protected outputs and two direct `bucket.file(...).createWriteStream` sites | **U** actual Cloud Run worker, service account, IAM, image, revision |

**Source emulator ports:** Auth `127.0.0.1:9099`, Firestore `127.0.0.1:8080`, Functions `5001`, Storage `127.0.0.1:9199`, Hosting `5000`, Pub/Sub `8085`, UI `4000`, Hub `4400`, logging `4500`. These are **local config**, not live resources.

**Hosting ambiguity to reconcile:** `firebase.json` hardcodes `urai-jobs-563121397472`, while `scripts/deploy-firebase.sh` defaults `FIREBASE_HOSTING_SITE` to `urai-jobs` and builds a temporary SHA-bound deployment config. Identify approved environment override and actual Hosting site/release; do not infer a deployed site or create it.

## 3. All 27 exported Functions in main (S, NOT LIVE INVENTORY)

**Queue/execution (9):** `getJobStatus`, `executeJob`, `processQueueTick`, `processQueueNow`, `retryExpiredLeases`, `cleanupTerminalJobs`, `systemReconcile`, `onJobTerminalEvent`, `publishJobTerminalEvents`.

**User/admin (9):** `createJob`, `getJob`, `cancelJob`, `listJobs`, `listJobLogs`, `retryJob`, `listJobsV2`, `listJobLogsV2`, `retryJobV2`.

**Service/bridges (9):** `buildInfo`, `studioLifeMovieBridge`, `studioLifeMovieLongformBridge`, `ingestConsentRevocation`, `submitDataRightsRequest`, `getDataRightsRequest`, `listDataRightsRequests`, `processDataRightsRequest`, `storytimeNarratorBridge`.

**Triggers/schedules in source:**
- `processQueueTick` v2 scheduled every 1 minute; `retryExpiredLeases` v2 scheduled every 1 minute.
- `publishJobTerminalEvents` v2 scheduled every 1 minute; default terminal topic `job-terminal-events`.
- `systemReconcile` v1 scheduled every 5 minutes.
- `executeJob` v2 Pub/Sub `onMessagePublished`, topic `PUBSUB_JOB_EXECUTION_TOPIC` or default `job-execution`; `timeoutSeconds:540`, distinct bounded worker timeout and original lease fences.
- `onJobTerminalEvent` and `cleanupTerminalJobs` v1 Firestore update triggers on `jobs/{jobId}`.
- `processQueueNow` v2 callable explicitly configured `us-central1`.
- Other v1/v2 callable/HTTPS surfaces are defined in their exact source; do not assume all have the same deploy region or generation.
- **U:** Cloud Scheduler actual schedules, Eventarc triggers, Pub/Sub topics/subscriptions, retry/error logs and deployed service accounts.

**Important coexistence:** The common `withAuthenticatedRole` wrapper remains a Firebase Functions **v1 callable** for historical Gen1 continuity, whereas queue Pub/Sub and some scheduling/bridge endpoints are v2. A source-wide Gen1→Gen2 migration without frozen name/revision acceptance would be unsafe.

## 4. Active admitted job types vs legacy planning registry (S)

`functions/src/core/runtimeJobTypes.ts` blob `849fd1ee6c875a4caeae258d9f82ae156ab71057` declares exactly 12 *active registry* keys (registration is not proof they can run):

| Type(s) | Owner / worker route | Mode / stated provider boundary |
| --- | --- | --- |
| `narrator.tts` | Jobs; `NARRATOR_WORKER_URL` `/execute-job` | sync; provider-bound, three attempts |
| `asset-render`, `asset.render` | Asset Factory; `ASSET_WORKER_URL` `/` | async callback-fenced; external provider HARD-OFF; legacy alias preserved |
| `studio.render.video` | Studio; `STUDIO_WORKER_URL` `/` | sync, short render; local-compute; protected MP4/SRT/manifest |
| `studio.assemble.video` | Studio; same worker | sync, bounded 480000ms longform assembly; private MP4/SRT |
| `communications.message.send` | Communications; `COMMUNICATIONS_WORKER_URL` `/executeJob` | sync, provider-bound |
| `memory.private-source.transcribe`, `memory.private-source.index` | Jobs private source; `PRIVATE_SOURCE_WORKER_URL` `/execute-job` | sync, source consent required, provider-bound |
| `memory.private-source.reconstruct-place` | Jobs Captured Reality; `CAPTURED_REALITY_WORKER_URL` `/execute-job` | async callback-fenced, dual consent |
| `web.search`, `web.fetch` | Jobs internal TinyFish provider; no worker URL | sync; provider-bound and actual funds unavailable in this session |
| `web.agent` | Jobs internal TinyFish provider | sync; explicit paid-run authorization, external provider HARD-OFF |

**Second independent source registry:** `functions/src/core/jobRegistry.ts` blob `22bced73969ff06515aa16af1d3b966be2a1ac60` declares many spatial, studio, narrator, asset, career and system queue/region planning entries including `spatial.render.scene` and `career.*`. These are **not** the same as the 12 active runtime registry keys. Do NOT count their presence as independently implemented/registered workers; the mismatch is a source taxonomy reconciliation task. A source declaration of `us-east1`/`us-west1` in this planning registry is **not** proof of any live regional service.

## 5. Source-defined lifecycle and Firestore collections

`createJob.ts` authenticates, validates type/payload, current owner/consent, assigns idempotency and creates `jobs/{jobId}`, `jobQueue/{jobId}`, initial job logs and reliability bindings in transaction. Main has a pre-transaction quota read; later unmerged reviews add owner-document atomic quota ledger and current owner/tenant/org checks.

The queue tick leases pending work; executor receives Pub/Sub message, verifies lease/job owner and executes approved worker or hard-off provider; cancellation, retries, stale lease reaper, optional dead-letter, terminal outbox and analytics trigger are implemented as source code. Studio receives a bounded server-to-server bearer request, validates tenant/project and signed SceneTruth/consent fields, creates short render or longform plan and children, reads original source-generation metadata, generates captions/movie and private result, then offers status/playback/download/delete actions. `URAI_LIFE_MOVIE_LONGFORM_ENABLED=true` is required to enable the longform bridge; it is not approved to turn on.

`ingestConsentRevocation` receives a server-authenticated HTTP event, transacts durable receipt/block, invokes derivative invalidation; its HTTP ACK is **not** proof Storage deletion. `dataRightsRequests` workflows export/delete Jobs-scope data and record central deletion handoff; not full ecosystem deletion. All later approved writes require current owner/privacy authority. The protected principal and physical output fences remain open.

**Source referenced Firestore paths (not live collection counts):** `users`, `jobs`, `jobs/{jobId}/logs`, `jobQueue`, `jobIdempotencyBindings`, `jobTerminalEventOutbox`, `jobConsentBlocks`, `jobConsentEventReceipts`, `dataRightsRequests`, `dataRightsRequests/{id}/audit`, `studioLifeMovieBridgeBindings`, `studioLifeMovieLongformPlans`, `studioLifeMovieLongformBindings`, `studioSceneTruthReceiptBindings`. Some are guarded by explicit Rules and all unknown/other client paths default-denied.

**Privacy nuance:** Direct Storage Rules allow `/jobs/{ownerUid}/{jobId}/...` and `/exports/{ownerUid}/...` reads by the matched owner UID or currently role=`admin`; these client Rules themselves do **not** inspect fresh purpose consent, deletion epoch, exact output generation, expired signed URLs, owner account state or revocation. Actual protected delivery semantics must be proved at the Studio/Jobs/Spatial broker AND by effective deployed bucket policy. This observation expands existing [P0 #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) acceptance, not a claim of a demonstrated production data leak.

## 6. Real cloud inventory: detailed unknowns (U, DO NOT INVENT)

| Service | Need to record after approved READ-ONLY control-plane access | Here |
| --- | --- | --- |
| Firebase project, apps and Auth | project number/state, platform app IDs, Auth providers, authorized domains, tenant/App Check enforcement, MFA settings (metadata only, no user PII) | UNKNOWN |
| Firestore | database IDs/locations, indexes states, current Ruleset/release, TTL, backup/PITR, policies, inventory counts (no document bodies) | UNKNOWN |
| Storage | all buckets, location, uniform bucket-level access, public prevention, object versioning/retention, IAM, old/stale writer principals, generation/CRC metadata from synthetic approved objects only | UNKNOWN |
| Functions v1/v2 | name, runtime, generation, region, labels, env-key **names only**, WIF/runtime service account, source SHA/build ID, latest revisions/traffic, events, retry policy | UNKNOWN |
| Cloud Run | narrator/asset/studio/private-source/captured-reality worker existence, service image digest/revision, region, ingress/auth, min/max instances, service account, VPC and delivery logs | UNKNOWN |
| Cloud Scheduler/Tasks | job names, target URLs, auth, cadence, queues, locations, retry/DLQ and deadletter handling | UNKNOWN |
| Pub/Sub/Eventarc | topics, subscriptions, push endpoints, publisher IAM, dead-letter policies, event triggers, filtering and delivery guarantees | UNKNOWN |
| IAM & Secret Manager | user/service identities, owner/admin/editor grants, WIF conditions, Storage object writer paths, bound secrets **metadata/versions only**, audit logging | UNKNOWN |
| Deploy/release | source commit→prebuilt manifest→Firebase release→Functions/Cloud Run revision, rollback ancestor and official reviewed approval | UNKNOWN |
| Monitoring/cost | log sink/retention, dashboards, alerts, quotas, CPU/timeouts, budget/billing continuity, outages | UNKNOWN |
| Hosting/domains | effective Hosting site(s), deployed SSL/domains/rewrites, `uraijobs.com` / www bindings, cache and robots | UNKNOWN |

`scripts/bootstrap-managed-worker-iam.sh` supports a legacy worker `roles/storage.objectAdmin` bucket grant if invoked. **Source permission to create such a grant is not evidence it exists**, but actual grants and alternate historical service accounts must be forensically inventoried before claiming sole-writer. `.github/workflows/urai-jobs-production-deploy.yml` describes protected WIF/Secret-Manager/deploy receipt checks and `scripts/deploy-firebase.sh` source-SHA manifest logic; neither establishes a successful live execution.

## 7. Read-only operator discovery commands (NOT EXECUTED; APPROVAL REQUIRED)

These commands are a **metadata-only starting point** and may still require working authenticated GCP access/quotas; don't try to invoke here or pay for new tools. Run only with authorized cloud-admin read rights, against the exact confirmed project, without user documents/secrets:

```sh
gcloud projects describe urai-jobs --format=json
gcloud functions list --project=urai-jobs --format=json
gcloud run services list --project=urai-jobs --format=json
gcloud firestore databases list --project=urai-jobs --format=json
gcloud storage buckets list --project=urai-jobs --format=json
gcloud pubsub topics list --project=urai-jobs --format=json
gcloud scheduler jobs list --project=urai-jobs --location=us-central1 --format=json
gcloud tasks queues list --project=urai-jobs --location=us-central1 --format=json
gcloud eventarc triggers list --project=urai-jobs --location=us-central1 --format=json
gcloud iam service-accounts list --project=urai-jobs --format=json
gcloud projects get-iam-policy urai-jobs --format=json
gcloud services list --enabled --project=urai-jobs --format=json
firebase hosting:sites:list --project urai-jobs
```

Enumerate **every discovered region/location**, not just `us-central1`. Read effective Rules/Storage IAM/revision metadata only after separately checking permitted API scope. Record source receipt URL, region, resource full name, create/update time, source/build SHA, policy ETag and access-denied reason. Never fetch secret payloads or private user records. There is no authorization in this document to deploy, enable APIs, create buckets/services or perform real-media writes.

**Decision:** Source inventory/reconciliation is evidence-backed for inspected repos; real cloud resource inventory is **not** obtained; P0 Storage writer fence, signed C6, full private Replay, full deletion and independent production controls remain **NO-GO / HOLD**. Read the companion R944 proof ledger, release blockers/runbook, machine checkpoint and next-Chalk entrypoint.
