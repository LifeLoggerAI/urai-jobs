# R865 / R866 - staging GCS retired-writer data-plane denial check (review only)

**Status: SOURCE-ONLY REVIEW / NO LIVE GCS PROBE / NOT AN IAM CERTIFICATE / P0 #252 OPEN / GENESIS HOLD.**

## Why this distinct check is needed

The R854 native Firebase emulator negative proof reproduced `privilegedBypassObserved=true` after consent withdrawal and point-in-time cleanup. R855/R856 preserve block ACK without falsely certifying derivative deletion. R857 adds the review-only physical-generation ledger. None of these demonstrate that historical credentials cannot create a GCS object when Firestore is fenced.

This independent, intentionally limited staging check uses an approved **retired or alternate service identity** to attempt to create one **zero-byte, uniquely named sentinel** under a dedicated staging-only test prefix. The JSON API request includes `ifGenerationMatch=0` so the attempt cannot overwrite an existing object. A 403 is recorded only as **one observed HTTP denial for that credential, bucket and moment**. A 401, credential-minting failure, malformed response, network failure, wrong source or absent proof of prior withdrawal is never considered a verified denial. HTTP 200/201 means the retired identity could still create a staging object: fail immediately and preserve a private cleanup-required record; do not automatically delete or continue testing other identities.

This check intentionally **does not** implement a production broker, change GCS IAM, perform uploads of private movies, issue C6 consent, authenticate an owner, or enable protected Replay. Its report always has `storageWriteFenceVerified=false`, `effectiveIamVerified=false`, `privateOutputDeletionAcknowledged=false`, and `productionGo=false` even if every configured identity receives a 403.

## Scope and execution protections

The new `scripts/review-only/staging-gcs-write-denial-probe.mjs` is not invoked by application code or a release script. The default CLI denies without touching credentials or network. A *future independently authorized staging security reviewer*, not a production worker, must supply all of the following:

- A separately approved, expendable GCP **staging or test** project and bucket whose actual names contain `staging`, `sandbox` or `test`, and not `prod`, `production` or `live`; no real customer data or production target is acceptable.
- Evidence of a **completed earlier revocation**; a reviewer-owned authorization reference; an inventory of every specific historic/alternate writer selected for this probe; and the exact clean Jobs source SHA. These manifest fields are claims requiring independent review; the script does **not** cryptographically certify them.
- GCP CLI access that can impersonate each **specified existing** service identity. Successful impersonation alone is *not* an effective IAM permission proof. A failed impersonation is `TOKEN_UNAVAILABLE`, never counted as a write-denial PASS.
- A manifest file with mode 0600 and an unused report destination in a private directory **outside** the repository; an exact CLI execution flag; and an additional opt-in environment value. A new 0600 **append-only JSONL audit journal** is created and fsynced **before** any credential or GCS request. A separate `PREPARED_BEFORE_NETWORK` event is appended and fsynced before each token or GCS request. A crash cannot truncate previous fsynced sentinel paths. The last event can be incomplete after a torn write and must be reviewed separately.

Example *shape only* (replace all fabricated data in a private 0600 file; do not commit it):

```json
{
  "schemaVersion": "urai-private-gcs-denial-staging-review-v1",
  "environment": "STAGING",
  "projectId": "urai-private-staging-test",
  "bucket": "urai-private-staging-test-bucket",
  "probePrefix": "__urai_security_staging__/post-revocation-denial/",
  "authorizationRef": "R865-review-approved-123",
  "withdrawalEventId": "withdraw-event-123",
  "withdrawalCommittedAt": "2026-11-07T05:00:00.000Z",
  "expectedJobsSourceSha": "REPLACE_WITH_EXACT_40_HEX_JOBS_SHA",
  "serviceAccounts": [
    {
      "email": "legacy-worker@urai-private-staging-test.iam.gserviceaccount.com",
      "kind": "retired-writer",
      "identityEvidenceRef": "IAM-LEGACY-001"
    },
    {
      "email": "alternate-writer@other-staging-test.iam.gserviceaccount.com",
      "kind": "alternate-writer",
      "identityEvidenceRef": "IAM-ALT-001"
    }
  ]
}
```

**Only after independent staging authorization** and establishing those private paths, an approved reviewer can execute:

```bash
export URAI_GCS_STAGING_NEGATIVE_PROBE_CONSENT=I_AUTHORIZE_ONLY_STAGING_ZERO_BYTE_GCS_DENIAL_ATTEMPTS
node scripts/review-only/staging-gcs-write-denial-probe.mjs \
  --manifest /secure/outside/repo/staging-manifest.json \
  --report /secure/outside/repo/new-denial-report.jsonl \
  --execute-staging-denial-probe
```

The process **always returns exit code 2 / HOLD**, even if all listed credentials were denied, and prints no bearer tokens or service-account addresses. Private audit journal JSONL files may contain staging object names, hashed principal references, and selected authorization references; keep them outside GitHub. The journal is **not** a single JSON document: entries are `STARTED_INCOMPLETE`, `PREPARED_BEFORE_NETWORK`, `HTTP_RESULT`, and `FINISHED_HOLD` or `INCOMPLETE_BLOCKED`. A crash may leave the final line torn; never discard any preceding fsynced entry. If an unexpected write succeeds, preserve its path and safely remediate under a separately authorized cleanup identity before any other testing. **Never run this example against a production bucket or real customer data.**

## Current verification and blockers

At R866, local Node 22 offline `node --test scripts/staging-gcs-write-denial-probe.test.mjs` **15/15 PASS** and `node --check` PASS. The extra three tests force-kill a child immediately after fsynced sentinel append, verify the sentinel survives, verify later records never replace earlier entries, and check for `O_EXCL | O_APPEND` plus `fsync` without truncation. These cover staging-only scoping, exact manifest structure, principal uniqueness, withdrawal-before-attempt, double operator opt-in, zero generation overwrite precondition, 403-only observations, 401/credential/transport failure, unexpected success, durable pre-attempt ledger ordering and fail-closed CLI. **No live GCS call, IAM mutation, new paid compute or full workspace build was executed for this independent draft.**

The actual P0 #252 cannot close until the service-account inventory is independently complete across projects/buckets, inherited IAM/groups/custom roles/impersonation are reviewed, old/alternate credentials receive actual data-plane denies, any active/resumable upload is drained or terminated, generation-pinned cleanup is complete, real positive signed owner C6 and source rights are connected, protected owner-only MP4/SRT Replay is proven, physical-device acceptance and protected CI pass, and explicit founder GO is authorized. This script alone can NEVER produce GO. Preserve other workers' R854/R855/R856/R857 paths and R861/R862 certificates as separate exact-source evidence.

## R866 crash-safety finding and narrow repair

The first R865 version used `ftruncateSync` before replacing the same private report with a complete JSON document. A process kill, disk failure, or power loss between truncation and the next complete fsync could erase a previously recorded pre-request sentinel. R866 changes **only the review probe and its tests/docs**, using an append-only, exclusive-created (`0600`) JSONL journal with `fsync` after each event and a no-symlink manifest check. The command still exits 2 and cannot authorize production. The previous R865 source blob remains available as immutable history; native full-source and staging IAM observations still require independent execution at the **new** commit.

## R867: ambiguous outcomes after a sent upload are potential leftover objects

The R866 probe had an important blind spot: a timed-out or reset connection can occur
**after** Cloud Storage commits the zero-byte object. Its prior classification
`TRANSPORT_UNVERIFIED` did not mark cleanup and continued attempting other
identities. An otherwise unexpected 2xx status outside 200/201 was also not
classified as a possible successful mutation. The R867 review-only patch does
not expand network scope; it treats all HTTP 2xx as `WRITE_WAS_ALLOWED` and
marks `cleanupRequired=true`, while an ambiguous transport/status response is
recorded as `TRANSPORT_UNVERIFIED` or `UNVERIFIED_RESPONSE` with the **same
conservative cleanup-review flag**. No object existence is inferred from the
ambiguous result. The probe stops after the first non-403 post-request result.
Only a definite 403 permits the next approved staging identity to be probed.
Credential minting failures occur before an upload and remain `TOKEN_UNAVAILABLE`
without implying a created object.

Every potentially unresolved sentinel path was already durably recorded by the
R866 append-only private journal before network access. R867 ensures the
resulting `HTTP_RESULT` also flags it for an independently authorized check.
An HTTP 412 may indicate that a live version already existed, per Google Cloud
Storage's `ifGenerationMatch=0` rules; it is **not** proof that this probe
created bytes, and it requires generation-aware review, not blind deletion.
No authorization to perform a cleanup or to inspect real customer objects is
provided by the tool. `productionGo`, `effectiveIamVerified`,
`storageWriteFenceVerified` and `privateOutputDeletionAcknowledged` remain false.

Local R867 verification: `node --check` and `node --test` **19/19 PASS**;
additional cases cover a simulated network reset after potential commit,
all 2xx statuses, 401/412/429/500 ambiguous outcomes and a continuing
403-only negative observation. These are mocked transport tests, **not** live
GCS data-plane evidence or a full source-build certificate.
