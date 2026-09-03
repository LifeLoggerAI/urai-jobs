# Auth Security Proof

Starting SHA: 9ad2137c2689e6aa936e72b0552a0a1913981714
Branch: production-lock-jobs-2026-06-30

## Source-level status

- Web `/admin` requires admin/operator claim.
- Web `/create` requires admin/operator or job-create claim.
- `createJob` requires an allowed role plus `admin`, `operator`, or `jobs:create` permission.
- `createJob` has job-type allowlist, max payload bytes, per-user create rate limit, and audit log.
- `cancelJob` allows owner or operator/admin only.
- `retryJobV2`, `listJobsV2`, `listJobLogsV2`, and `processQueueNow` require operator/admin access.
- Firestore rules deny direct client writes to jobs, queue, and logs.
- Narrator worker `/execute-job` requires a token outside local/emulator mode.

## Remaining risks

- Need deployed IAM/token verification.
- Need redaction review for payload and result logs.
- Need staged unauthorized-call proof.
- Need org-level query scoping review for multi-tenant use.
