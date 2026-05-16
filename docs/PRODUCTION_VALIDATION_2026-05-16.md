# URAI Jobs Runtime Production Validation - 2026-05-16

## Release identity

- Release date: 2026-05-16
- Release owner: URAI Labs
- Commit SHA: 39eac330ff5fb145974c3988adfaab4561b28da1
- Pull request: #40
- Target environment: production-ready main branch
- Firebase project: pending operator confirmation
- Hosting URL: pending deploy confirmation
- Custom domain status: pending deploy confirmation

## Scope

This release promotes URAI Jobs as the hardened internal runtime system-of-systems release.

Included changes:

- Runtime boundary enforcement
- Public marketplace route removal from runtime app
- Firebase Storage deploy and security gates
- Storage rules validation in deploy precheck
- Narrator worker compatibility and Cloud Run readiness

## Runtime boundary confirmation

- [x] This release activates or updates the URAI Jobs Runtime only.
- [x] This release does not activate public marketplace flows.
- [x] Marketplace-related behavior remains deferred and separately chartered.

## Required checks

| Check | Result | Evidence |
| --- | --- | --- |
| `pnpm run activation:verify` | PASS | Terminal validation |
| `pnpm run urai-jobs:verify` | PASS | Terminal validation |
| `pnpm run urai-jobs:smoke` | PASS | Terminal validation |
| `pnpm run typecheck` | PASS | Terminal validation |
| `pnpm run build` | PASS | Terminal validation |
| `pnpm run urai-jobs:deploy-precheck` | PASS | Terminal validation |
| `pnpm run urai-jobs:e2e` | Not run in final local gate | Requires emulator/live operator run |
| `pnpm run prod:precheck` | Not run | Requires production environment |
| `pnpm run prod:smoke` | Not run | Requires production environment |

## Smoke evidence

- Smoke job ID: local/static smoke only
- Job type: narrator/spatial/privacy owner-map smoke coverage
- Initial job status: compatibility rules validated
- Initial queue status: deploy precheck validated
- Terminal job status: local smoke validates retry/cancel rules
- Terminal queue status: deploy precheck validates status surface
- Logs verified: pending production deploy
- Result/artifact verified: pending production deploy
- Worker verified: build/typecheck passed

## Runtime status verification

Canonical job statuses verified by activation readiness:

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

## Deployment evidence

- Deploy command or workflow: pending operator deployment
- Workflow run URL: no workflow run reported for merge commit
- Deployed commit: pending operator deployment
- Deployment timestamp: pending operator deployment
- Operator who deployed: pending
- Rollback command/path: revert PR #40 or deploy previous known-good commit

## Security and operations checks

- [x] Storage rules are included in Firebase deploy surface.
- [x] Storage emulator is configured.
- [x] Broad authenticated Storage read/write is blocked.
- [x] Storage rules include default deny.
- [x] Runtime app excludes public candidate, employer, jobs, and pricing routes.
- [ ] Admin/operator access verified in production.
- [ ] Non-admin behavior verified in production.
- [ ] Required runtime environment configuration verified outside git.
- [ ] Monitoring or logs checked after deploy.

## Known risks and follow-ups

| Priority | Risk or follow-up | Owner | Target date |
| --- | --- | --- | --- |
| High | Run production precheck and production smoke after environment deployment | URAI operator | Next deploy |
| High | Resolve repository dependency/security alerts reported by GitHub | URAI engineering | Next security pass |
| Medium | Add emulator-backed Storage rules tests | URAI engineering | Next hardening pass |
| Medium | Verify Cloud Run worker invocation auth/signature posture | URAI engineering | Next hardening pass |

## Release decision

- [ ] Approved for production.
- [ ] Blocked.
- [ ] Rolled back.

Decision notes:

Main branch is release-hardened and locally validated. Production approval remains pending live environment deployment, production smoke, and operator sign-off.
