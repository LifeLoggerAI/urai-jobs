# URAI Jobs Activation Readiness Plan

This repository is the URAI Jobs Runtime.

Required checks:

- `pnpm run activation:verify`
- `pnpm run urai-jobs:verify`
- `pnpm run urai-jobs:smoke`
- `pnpm run typecheck`
- `pnpm run test`
- `pnpm run build`

CI enforcement:

- The runtime CI workflow runs `pnpm activation:verify` as an explicit activation-readiness step.
- The runtime CI workflow also runs `pnpm urai-jobs:verify`, which chains the activation guard with the broader repository invariant checks.

Canonical job statuses from `functions/src/core/types.ts`:

- `CREATED`
- `QUEUED`
- `RUNNING`
- `SUCCESS`
- `FAILED`
- `RETRY`
- `DEAD`
- `CANCELLED`

Canonical queue statuses from `functions/src/core/types.ts`:

- `READY`
- `LEASED`
- `DONE`
- `DEAD`

Shared compatibility statuses from `packages/shared-types/src/index.ts`:

These are compatibility values for shared runtime surfaces and should not be treated as canonical `JobStatus` values unless the core runtime schema is intentionally migrated.

- `PENDING`
- `LEASED`
- `RUNNING`
- `SUCCESS`
- `FAILED`
- `DEAD`
- `CANCELLED`

Release rule:

Do not mark runtime activation complete unless the required checks pass and production evidence is recorded in the release notes or validation docs.
