# R585 - Jobs IAM review evidence convergence (REVIEW ONLY / GENESIS HOLD)

This is an explicit **two-parent review source reconciliation** of:
- Jobs #267, region bound / unique Service and revision inventory: 4f4ef103bdf71415015b66e714abb788afa9f500
- Jobs #266, retained Cloud Run Job executions / conservative drain evidence: d62f6f9f5e2118fc26894fc44c4f1e0e4f32a791

The combined source retains the region-specific collector identity and rejects wrong/missing expected region, fabricated global coverage, duplicated Cloud Run services and revisions. It also reads each named Cloud Run Job's bounded retained executions and rejects incomplete, malformed, duplicate or out-of-Job-scope entries; unknown or active execution states remain blockers. The audit accepts only the exact new single-region/retained-execution collector-coverage marker, and **always** returns HOLD, productionAuthorized=false, liveEffectiveIamVerified=false and revokeAckPermitted=false. New negative tests from BOTH review branches remain enrolled. Operator documentation is updated so it no longer claims retained executions are absent.

**At source creation:** fresh native verification, exact-SHA blob readback, protected GitHub CI, independent nonauthor approval and all live GCS/Cloud IAM acceptance tests are **PENDING**. Do not inherit either predecessor's green run as proof for this new SHA. No worker, private-output enablement, Storage Rules, IAM policy, owner grant, bucket, cloud secret, deployment or production artifact is changed.

**Outstanding P0:** Jobs #252 — post-revocation old-principal real GCS 403, signed URL / alternate identity denial, already-running upload drain, exact generation deletion, trusted owner C6 authority, authenticated private Movie-to-Spatial Replay-to-deletion, protected CI plus independent review and Founder GO. No raw IAM snapshot may be attached to PRs or Drive. All launch controls remain G0-G7 **HOLD**.
