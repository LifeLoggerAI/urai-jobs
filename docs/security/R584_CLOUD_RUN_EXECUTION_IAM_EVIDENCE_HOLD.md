# R584 — Cloud Run Job execution visibility, retention-bound evidence (HOLD)

The R537 private IAM evidence collector enumerated Cloud Run **Job definitions** but did not list their *executions*. A job definition's current service account is not proof about a historical instance, running task or stale writer. This review-only change adds read-only `gcloud run jobs executions list --job JOB --region REGION --limit 500` for every enumerated Job in a single approved project/region. Google Cloud documents this operation in its Cloud Run execution management and gcloud reference. It does **not** call jobs execute/cancel/delete, touch GCS objects, grant IAM or turn on the Studio writer.

## Fail-closed conditions

- A denied or malformed execution-list read fails the entire private snapshot; no partial approval.
- Reaching the per-job 500-execution cap is treated as incomplete rather than as all retained history.
- Duplicate identities, mismatched Job labels, malformed execution names and unknown state are rejected or marked `ACTIVE_OR_UNVERIFIED`.
- Only an explicit `Completed=True` condition and valid completion time with no running tasks qualifies as `RECORDED_TERMINAL`; that label is **not** authenticated historical service-account or GCS stream-drain evidence.
- The offline IAM auditor flags missing inventory, active/uncertain executions, malformed/cross-job records and **always** includes `RETAINED_JOB_EXECUTIONS_NOT_FULL_HISTORICAL_OR_UPLOAD_DRAIN_PROOF`.
- The entire audit remains **`verdict=HOLD`, `productionAuthorized=false`, `liveEffectiveIamVerified=false`, `revokeAckPermitted=false`**, even if every retained execution is terminal.

Execution listing is region-limited, retention-limited and cannot prove all historical accounts, regions, revisions or private buckets. It cannot replace actual old-principal Google Cloud Storage 403 denial, signed URL invalidation, outstanding upload drain and exact generation readbacks. The Studio private output writer and protected deploy hard-off MUST remain byte-identical. Any real GCP read requires a separately approved existing read-only operator; no private snapshots, identities, credentials or media may enter public GitHub receipts.

To test without GCP, run `node --test scripts/capture-studio-storage-iam-evidence.test.mjs scripts/studio-storage-iam-snapshot-audit.test.mjs` and the maintained `npm run urai-jobs:verify` on an exact detached review commit. Scope is strictly review-only: Jobs #252 P0 and Genesis G0-G7 HOLD; no merge, cloud mutation or release.
