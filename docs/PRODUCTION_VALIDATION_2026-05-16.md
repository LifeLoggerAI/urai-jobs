# URAI Jobs Runtime Production Validation - 2026-05-16

## Release identity

- Release date: 2026-05-16
- Release owner: URAI Labs
- Commit SHA: main as of production deploy
- Pull request: #40, #41
- Target environment: production
- Firebase project: urai-jobs
- Hosting URL: https://urai-jobs-563121397472.web.app
- Custom domain status: pending

## Scope

This release promotes URAI Jobs as the hardened internal runtime system-of-systems runtime.

Included changes:

- Runtime boundary enforcement
- Public marketplace route removal from runtime app
- Firebase Storage deploy and security gates
- Storage rules validation in deploy precheck
- Narrator worker compatibility and Cloud Run readiness
- Cloud Run worker deployment
- Firebase Functions, Firestore rules/indexes, and Hosting deployment

## Runtime boundary confirmation

- [x] This release activates or updates the URAI Jobs Runtime only.
- [x] This release does not activate public marketplace flows.
- [x] Marketplace-related behavior remains deferred and separately chartered.

## Required checks

| Check | Result | Evidence |
| --- | --- | --- |
| `pnpm urai-jobs:verify` | PASS | Terminal validation |
| `pnpm urai-jobs:smoke` | PASS | Terminal validation |
| `pnpm urai-jobs:deploy-precheck` | PASS | Terminal validation |
| `pnpm build` | PASS | Terminal validation |
| `pnpm typecheck` | PASS | Terminal validation |
| `pnpm deploy:workers` | PASS | Cloud Run deployed narrator, asset, spatial, and studio workers |
| `pnpm deploy:firebase:prod -- prod` | PASS | Firebase deploy completed for project `urai-jobs` |
| `pnpm prod:smoke` | PENDING | Requires real short-lived Firebase Auth ID token |

## Deployment evidence

- Firebase project: urai-jobs
- Hosting site: urai-jobs-563121397472
- Hosting URL: https://urai-jobs-563121397472.web.app
- Firestore rules: released
- Firestore indexes: deployed
- Firebase Functions: updated
- Firebase Hosting: release complete

## Worker deployment evidence

| Worker | URL | Status |
| --- | --- | --- |
| narrator-worker | https://narrator-worker-wkyojbnbiq-uc.a.run.app | deployed |
| asset-worker | https://asset-worker-wkyojbnbiq-uc.a.run.app | deployed |
| spatial-worker | https://spatial-worker-wkyojbnbiq-uc.a.run.app | deployed |
| studio-worker | https://studio-worker-wkyojbnbiq-uc.a.run.app | deployed |

## Smoke evidence

- Smoke job ID: pending
- Job type: pending
- Initial job status: pending
- Initial queue status: pending
- Terminal job status: pending
- Terminal queue status: pending
- Logs verified: pending
- Result/artifact verified: pending
- Worker verified: pending runtime smoke

## Runtime status verification

Canonical job statuses verified by local validation:

- [x] `CREATED`
- [x] `QUEUED`
- [x] `RUNNING`
- [x] `SUCCESS`
- [x] `FAILED`
- [x] `RETRY`
- [x] `DEAD`
- [x] `CANCELLED`

Canonical queue statuses verified:

- [x] `READY`
- [x] `LEASED`
- [x] `DONE`
- [x] `DEAD`

Compatibility statuses verified:

- [x] `PENDING`
- [x] `LEASED`
- [x] `RUNNING`
- [x] `SUCCESS`
- [x] `FAILED`
- [x] `DEAD`
- [x] `CANCELLED`

## Security and operations checks

- [x] Storage rules are included in Firebase deploy surface.
- [x] Storage emulator is configured.
- [x] Broad authenticated Storage read/write is blocked.
- [x] Storage rules include default deny.
- [x] Runtime app excludes public candidate, employer, jobs, and pricing routes.
- [x] Firestore rules released.
- [x] Firebase Functions deployed.
- [x] Firebase Hosting deployed.
- [ ] Production authenticated smoke verified.
- [ ] Smoke job reaches terminal state.
- [ ] Logs and artifacts verified.
- [ ] Admin/operator auth verified.
- [ ] Custom domain verified.

## Known risks and follow-ups

| Priority | Risk or follow-up | Owner | Target date |
| --- | --- | --- | --- |
| High | Run production authenticated smoke with real Firebase Auth ID token | URAI operator | Immediate |
| High | Verify Firestore job and queue terminal state after smoke | URAI operator | Immediate |
| High | Verify logs and GCS artifact for artifact-producing job | URAI operator | Immediate |
| Medium | Resolve worker `/healthz` 404 or update health check route expectations | URAI engineering | Next hardening pass |
| Medium | Resolve GitHub dependency/security alerts | URAI engineering | Next security pass |
| Medium | Configure custom domain if required | URAI operator | Launch polish |

## Release decision

- [ ] Approved for production.
- [x] Blocked from final done-done signoff pending production authenticated smoke.
- [ ] Rolled back.

Decision notes:

URAI Jobs runtime infrastructure is deployed to production Firebase and Cloud Run. Final done-done production readiness remains pending authenticated production smoke, terminal job/queue verification, logs/artifact verification, and admin/operator auth verification.

## Production authenticated smoke evidence

- Result: PASS
- Job ID: 01KRSARZS653XRZW19R92TVTK9
- Job type: narrator.tts
- Auth mode: provided Firebase Auth ID token
- Callable createJob: PASS
- Callable getJob: PASS
- Observed terminal status: COMPLETED
- Worker lease: cloud-run-worker
- Payload outputPrefix: prod-smoke/1778966624134

Terminal evidence:

[PASS] Using provided Firebase Auth ID token for smoke.
[PASS] createJob returned 01KRSARZS653XRZW19R92TVTK9
[PASS] getJob returned status COMPLETED
[PASS] URAI Jobs Runtime production smoke submitted and status callable responded.
