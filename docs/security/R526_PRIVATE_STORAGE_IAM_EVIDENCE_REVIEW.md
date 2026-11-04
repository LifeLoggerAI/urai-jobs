# R526 — Private Storage IAM evidence review (HOLD / no production authority)

This is a review guide, not permission to deploy Studio, create derivatives or mark Genesis ready.

## Code and branch boundaries
- Jobs #253 denies both Studio private-output upload paths.
- Jobs #257 and #260 move the Studio deployment veto to the earliest executable step.
- R526 permanently retires scripts/bootstrap-managed-worker-iam.sh as a non-mutating denial and removes historical bucket-creation and generic Storage objectAdmin commands rather than leaving them dormant.
- Jobs #259 is a parallel, less restrictive proposal for a future non-Studio bootstrap. An independent reviewer must reconcile it explicitly.
- These source guards do NOT revoke existing IAM or signed URLs.

## Collect READ-ONLY IAM evidence privately
A reviewer with approved GCP access must inventory every real project and bucket used for private derivatives. Keep raw IAM policies, service-account emails, revision details, keys and signed URLs in a private, access-controlled location OUTSIDE the repository. Never upload those raw files to GitHub.

Example read-only CLI operations (replace placeholders with verified scopes):

    gcloud projects get-iam-policy PROJECT_ID --format=json
    gcloud storage buckets get-iam-policy gs://APPROVED_BUCKET --format=json
    gcloud run services list --project=PROJECT_ID --region=REGION --format=json
    gcloud run revisions list --project=PROJECT_ID --region=REGION --format=json

Also review folder/organization inherited roles, custom roles, service-account impersonation and keys, all Cloud Run revisions, temporary upload credentials, resumable upload sessions, old deployments, alternate buckets and write-capable build/deploy principals. A bucket policy alone cannot prove effective access.

## Offline diagnostic (NEVER returns release GO)
Normalize private evidence into this JSON shape, stored outside the repository:

    {
      "schemaVersion":"urai-studio-private-storage-iam-review-v1",
      "projectId":"example-project-id",
      "bucket":"example-approved-private-bucket",
      "collectedAt":"2026-11-04T05:00:00.000Z",
      "projectPolicy":{"version":3,"bindings":[]},
      "bucketPolicy":{"version":3,"bindings":[]},
      "ancestorPolicies":[{"level":"organization","policy":{"version":3,"bindings":[]}}],
      "runServices":[{"name":"urai-studio-worker","serviceAccount":"studio@example-project-id.iam.gserviceaccount.com"}],
      "revisionInventory":[{"name":"urai-studio-worker-00001","serviceAccount":"studio@example-project-id.iam.gserviceaccount.com"}]
    }

The example is fabricated and is NOT secure-config evidence. Real evidence must be collected and normalized, not invented.

Offline command:

    node scripts/review-only/studio-storage-iam-snapshot-audit.mjs --snapshot /private/path/iam-evidence.json --project example-project-id --bucket example-approved-private-bucket

The script never contacts GCP, never changes IAM and prints aggregate HOLD reason codes instead of principal names. It deliberately exits nonzero even if no direct broad grants appear. The SHA256 digest identifies only the supplied input, not its completeness or truth.

## Mandatory actual P0 acceptance
1. Independently validate effective IAM, including inherited roles, groups, conditions, custom roles, impersonation and historical principals.
2. Restrict private derivative writes to the one authenticated scoped broker; demonstrate GCS-denied direct writes by retired/alternate principals.
3. Transactionally fence revocation BEFORE upload drain; prove old uploads cannot finalize after cleanup acknowledgment, and reconcile exact generations in every approved bucket.
4. Test stale-generation precondition failure on REAL protected GCS; Firebase emulator limitations preclude production conclusions.
5. Prove private Replay denial immediately after withdrawal, no reusable delivery URLs or caching bypass, generation-conditional deletion and final absence.
6. Finish exact-SHA CI, protected staging/rollback, legitimate consent rights, independent approval and founder release GO.

GENESIS HOLD / Jobs #252 P0 OPEN. No automatic merge, IAM mutation, deployment, consent activation or private media from this guide.
