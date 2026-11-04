# R536–R537 — private Storage IAM read-only evidence collection (HOLD)

This is an **administrator-only, read-only inventory** for [Jobs #252](https://github.com/LifeLoggerAI/urai-jobs/issues/252), **not approval**, an IAM mutation, a released broker, or real post-revocation write-denial proof.

The new Node 22 collector `scripts/review-only/capture-studio-storage-iam-evidence.mjs` uses only read operations: project and bucket `get-iam-policy`, project `get-ancestors`, folder/organization `get-iam-policy`, and Cloud Run `services list`, `revisions list`, **`jobs list`**, and read-only **`jobs describe` for every listed Job**, for **one explicitly selected region**. Cloud Run Jobs have independent runtime service identities and do not appear in the service/revision lists. The resulting schema is accepted by the existing `studio-storage-iam-snapshot-audit.mjs`. It never requests permission changes or enables output writes.

## Authorized operator procedure (no new infrastructure)

Use an **existing**, authorized GCP identity with read-only IAM and Cloud Run inventory permissions. Do not create accounts or resources merely to complete this checklist. Set actual approved IDs in your own shell; **never commit identities or policy JSON**.

```sh
umask 077
mkdir -p "$HOME/urai-private-iam-evidence"
chmod 700 "$HOME/urai-private-iam-evidence"
node scripts/review-only/capture-studio-storage-iam-evidence.mjs --project "$APPROVED_GCP_PROJECT" --bucket "$APPROVED_PRIVATE_BUCKET" --region "$APPROVED_GCP_REGION" --out "$HOME/urai-private-iam-evidence/iam-snapshot.json"
node scripts/review-only/studio-storage-iam-snapshot-audit.mjs --snapshot "$HOME/urai-private-iam-evidence/iam-snapshot.json" --project "$APPROVED_GCP_PROJECT" --bucket "$APPROVED_PRIVATE_BUCKET" --region "$APPROVED_GCP_REGION"
```

**Expected:** collector exits 0 only for saved raw evidence in a directory with owner-only permissions; snapshot is created mode `0600` and existing files are never overwritten. Offline audit deliberately reports `verdict: HOLD` and ordinarily exits 2 (non-zero); its non-zero status is **not** a failure of permissions or evidence capture. Keep the raw file private and out of GitHub, Drive, PR comments, logs and public artifacts; only aggregate finding codes, digest and counts may enter a release receipt.

**Limitations:** The collector covers only one region per invocation, snapshots current Cloud Run Job definitions, and does **not** inventory historical or active Job executions, Cloud Run worker pools/instances, or all other regions. It cannot prove every historical identity, all other buckets/projects, hidden inherited/custom roles, alternate credentials, old signed URLs or blocked old-principal GCS writes. Any permission/read error blocks capture without producing approval. Cloud IAM effective access and actual post-withdrawal GCS negative tests remain independently required. Any real cloud access requires the previously authorized read-only scope; B/C positive cloud setup, user media, grants, paid compute and production GO remain unapproved.

**Verification:** `node --test scripts/capture-studio-storage-iam-evidence.test.mjs` uses synthetic policy data and a mocked `gcloud` executable; it does **not** access Google Cloud. New collector tests are also enrolled in the maintained `urai-jobs:verify` script. Keep Studio output and deployment hard-off until approved broker-exclusive IAM, revocation epochs, upload-drain proof and independent review.


## R584 — Region-bound IAM evidence review (HOLD)

The offline auditor now requires the exact approved --region in addition to project and bucket. It rejects wrong or missing collection regions, fake worldwide-coverage markers, and duplicated Cloud Run service/historic revision records. Every result remains HOLD; even a matching single-region inventory cannot establish global effective IAM, old-writer GCS denial, signed-URL revocation, active upload draining or generation-bound physical deletion. Do not expose raw IAM policies or principal identities in GitHub, Drive or a public release receipt. The Studio private-output hard-off interlock is unchanged.
