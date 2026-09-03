# URAI Jobs Runtime Production Validation - 2026-05-16

## Release identity

- Release date: 2026-05-16
- Release owner: URAI Labs
- Commit SHA: main as of production deploy and authenticated smoke verification
- Pull requests: #40, #41, #43 and follow-up main commits
- Target environment: production
- Firebase project: urai-jobs
- Hosting site: urai-jobs-563121397472
- Hosting URL: https://urai-jobs-563121397472.web.app
- Custom domain status: pending / not required for runtime production signoff

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
- Production authenticated smoke validation
- Manual production admin UI verification

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
| `pnpm prod:smoke` | PASS | Authenticated Firebase ID-token production smoke created and read completed job |

## Deployment evidence

- Firebase project: urai-jobs
- Hosting site: urai-jobs-563121397472
- Hosting URL: https://urai-jobs-563121397472.web.app
- Hosting HTTP check: 200
- Firestore rules: released
- Firestore indexes: deployed
- Firebase Functions: updated and listed on Node.js 22
- Firebase Hosting: release complete
- Cloud Run workers: listed in us-central1

## Worker deployment evidence

| Worker | URL | Status |
| --- | --- | --- |
| narrator-worker | https://narrator-worker-563121397472.us-central1.run.app | deployed and root health PASS |
| asset-worker | https://asset-worker-563121397472.us-central1.run.app | deployed |
| spatial-worker | https://spatial-worker-563121397472.us-central1.run.app | deployed |
| studio-worker | https://studio-worker-563121397472.us-central1.run.app | deployed |
| urai-jobs-worker | https://urai-jobs-worker-563121397472.us-central1.run.app | deployed |

Narrator worker health response:

```json
{"service":"narrator-worker","ok":true}
```

Asset, spatial, and studio workers were verified as deployed Cloud Run services. Root `/` returned 404 for those workers, which is not a production blocker because those services do not expose the same root health contract as narrator-worker.

## Authenticated production smoke evidence

- Smoke command: `pnpm prod:smoke`
- Auth mode: provided short-lived Firebase Auth ID token for smoke user
- Smoke user: `urai-jobs-prod-smoke`
- Job ID: `01KRSEFP2WM8VBSE4DW40CYMJX`
- Job type: `narrator.tts`
- Payload text: `URAI Jobs Runtime production smoke test`
- Voice: `en-US-Wavenet-D`
- Locale: `en-US`
- Format: `MP3`
- Output prefix: `prod-smoke/1778970513518`
- createJob callable: PASS
- getJob callable: PASS
- Terminal job status: `COMPLETED`
- Worker name: `cloud-run-worker`
- Attempt count: 1
- Max attempts: 3
- Owner UID: `urai-jobs-prod-smoke`

Smoke terminal response excerpt:

```json
{
  "job": {
    "id": "01KRSEFP2WM8VBSE4DW40CYMJX",
    "jobId": "01KRSEFP2WM8VBSE4DW40CYMJX",
    "type": "narrator.tts",
    "jobType": "narrator.tts",
    "ownerUid": "urai-jobs-prod-smoke",
    "status": "COMPLETED",
    "execution": {
      "attemptCount": 1,
      "maxAttempts": 3
    },
    "lease": {
      "workerName": "cloud-run-worker"
    }
  },
  "logs": []
}
```

## Manual production UI smoke evidence

Manual production UI smoke passed against the production Hosting URL.

Verified:

- `/admin` route loads successfully.
- Admin dashboard renders production queue state.
- Dashboard displayed 5 loaded jobs.
- Queue columns render for queued, leased, and running state.
- Job controls are visible, including Details and Cancel.

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
- [x] Production authenticated smoke verified.
- [x] Smoke job reaches terminal state.
- [x] Manual admin/operator UI verified.
- [x] Temporary smoke token state cleaned locally after test.
- [ ] Custom domain verified.
- [ ] GitHub dependency/security alerts remediated.

## Known risks and follow-ups

| Priority | Risk or follow-up | Owner | Target date |
| --- | --- | --- | --- |
| Medium | Configure and verify custom domain if runtime requires a branded production URL | URAI operator | Launch polish |
| Medium | Resolve worker root health route consistency for asset/spatial/studio, or document route expectations | URAI engineering | Next hardening pass |
| Medium | Resolve GitHub dependency/security alerts reported by GitHub | URAI engineering | Next security pass |
| Low | Add a repeatable token-free production smoke path that avoids local ADC custom-token minting issues | URAI engineering | Next automation pass |

## Release decision

- [x] Approved for production.
- [x] Production infrastructure deployed.
- [x] Production UI manually verified.
- [x] Authenticated production smoke passed.
- [ ] Rolled back.

Decision notes:

URAI Jobs runtime infrastructure is deployed to production Firebase and Cloud Run. Manual production UI verification passed. Authenticated production smoke passed with a completed `narrator.tts` job. Remaining work is launch polish and security hardening, not a blocker for runtime production readiness.

## Final statement

urai-jobs is production-ready.
