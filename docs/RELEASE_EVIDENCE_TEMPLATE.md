# URAI Jobs Runtime Release Evidence Template

Copy this file to `docs/PRODUCTION_VALIDATION_<YYYY-MM-DD>.md` for each production runtime activation or release.

## Release identity

- Release date:
- Release owner:
- Commit SHA:
- Pull request:
- Target environment:
- Firebase project:
- Hosting URL:
- Custom domain status:

## Scope

Describe what changed in this release.

## Runtime boundary confirmation

- [ ] This release activates or updates the URAI Jobs Runtime only.
- [ ] This release does not activate public marketplace flows.
- [ ] Any marketplace-related changes are documented as scaffolded, deferred, or separately chartered.

## Required checks

Record command results and links to logs where available.

| Check | Result | Evidence |
| --- | --- | --- |
| `pnpm run activation:verify` |  |  |
| `pnpm run urai-jobs:verify` |  |  |
| `pnpm run urai-jobs:smoke` |  |  |
| `pnpm run typecheck` |  |  |
| `pnpm run test` |  |  |
| `pnpm run build` |  |  |
| `pnpm run urai-jobs:e2e` |  |  |
| `pnpm run urai-jobs:deploy-precheck` |  |  |
| `pnpm run prod:precheck` |  |  |
| `pnpm run prod:smoke` |  |  |

## Smoke evidence

- Smoke job ID:
- Job type:
- Initial job status:
- Initial queue status:
- Terminal job status:
- Terminal queue status:
- Logs verified:
- Result/artifact verified:
- Worker verified:

## Runtime status verification

Confirm persisted job state used only canonical job statuses:

- [ ] `CREATED`
- [ ] `QUEUED`
- [ ] `RUNNING`
- [ ] `SUCCESS`
- [ ] `FAILED`
- [ ] `RETRY`
- [ ] `DEAD`
- [ ] `CANCELLED`

Confirm persisted queue state used only canonical queue statuses:

- [ ] `READY`
- [ ] `LEASED`
- [ ] `DONE`
- [ ] `DEAD`

Confirm shared runtime compatibility surfaces still accept expected compatibility statuses where used:

- [ ] `PENDING`
- [ ] `LEASED`
- [ ] `RUNNING`
- [ ] `SUCCESS`
- [ ] `FAILED`
- [ ] `DEAD`
- [ ] `CANCELLED`

## Deployment evidence

- Deploy command or workflow:
- Workflow run URL:
- Deployed commit:
- Deployment timestamp:
- Operator who deployed:
- Rollback command/path:

## Security and operations checks

- [ ] Admin/operator access verified.
- [ ] Non-admin behavior verified where applicable.
- [ ] No sensitive configuration committed.
- [ ] Required runtime environment configuration verified outside git.
- [ ] Monitoring or logs checked after deploy.
- [ ] Known production risks documented below.

## Known risks and follow-ups

| Priority | Risk or follow-up | Owner | Target date |
| --- | --- | --- | --- |
|  |  |  |  |

## Release decision

- [ ] Approved for production.
- [ ] Blocked.
- [ ] Rolled back.

Decision notes:
