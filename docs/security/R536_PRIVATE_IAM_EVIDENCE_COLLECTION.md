# R536 — private Storage IAM read-only evidence collection (HOLD)

This is an **administrator-only, read-only inventory** for [Jobs #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252), **not approval**, an IAM mutation, a released broker, or real post-revocation write-denial proof.

The new Node 22 collector `scripts/review-only/capture-studio-storage-iam-evidence.mjs` uses only read operations: project and bucket `get-iam-policy`, project `get-ancestors`, folder/organization `get-iam-policy`, and Cloud Run `services list` / `revisions list` for **one explicitly selected region**. The resulting schema is accepted by the existing `studio-storage-iam-snapshot-audit.mjs`. It never requests permission changes or enables output writes.

## Authorized operator procedure (no new infrastructure)

Use an **existing**, authorized GCP identity with read-only IAM and Cloud Run inventory permissions. Do not create accounts or resources merely to complete this checklist. Set actual approved IDs in your own shell; **never commit identities or policy JSON**.

```sh
umask 077
mkdir -p "$HOME/urai-private-iam-evidence"
chmod 700 "$HOME/urai-private-iam-evidence"
node scripts/review-only/capture-studio-storage-iam-evidence.mjs --project "$APPROVED_GCP_PROJECT" --bucket "$APPROVED_PRIVATE_BUCKET" --region "$APPROVED_GCP_REGION" --out "$HOME/urai-private-iam-evidence/iam-snapshot.json"
node scripts/review-only/studio-storage-iam-snapshot-audit.mjs --snapshot "$HOME/urai-private-iam-evidence/iam-snapshot.json" --project "$APPROVED_GCP_PROJECT" --bucket "$APPROVED_PRIVATE_BUCKET"
```

**Expected:** collector exits 0 only for saved raw evidence in a directory with owner-only permissions; snapshot is created mode `0600` and existing files are never overwritten. Offline audit deliberately reports `verdict: HOLD` and ordinarily exits 2 (non-zero); its non-zero status is **not** a failure of permissions or evidence capture. Keep the raw file private and out of GitHub, Drive, PR comments, logs and public artifacts; only aggregate finding codes, digest and counts may enter a release receipt.

**Limitations:** The collector covers only one region per invocation and cannot prove every historical identity, all other buckets/projects/regions, hidden inherited/custom roles, alternate credentials, old signed URLs or blocked old-principal GCS writes. Any permission/read error blocks capture without producing approval. Cloud IAM effective access and actual post-withdrawal GCS negative tests remain independently required. Any real cloud access requires the previously authorized read-only scope; B/C positive cloud setup, user media, grants, paid compute and production GO remain unapproved.

**Verification:** `node --test scripts/capture-studio-storage-iam-evidence.test.mjs` uses synthetic policy data and a mocked `gcloud` executable; it does **not** access Google Cloud. New collector tests are also enrolled in the maintained `urai-jobs:verify` script. Keep Studio output and deployment hard-off until approved broker-exclusive IAM, revocation epochs, upload-drain proof and independent review.
