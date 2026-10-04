# URAI Jobs Data Rights Workflow

## Purpose

This document defines the launch-ready workflow for user data export, deletion, privacy review, and support handling in URAI Jobs.

URAI Jobs can store operational data linked to users, operators, employers, candidates, job submissions, job payload references, logs, and artifacts. Data-rights workflows must avoid exposing raw secrets, internal-only logs, or unrelated users' data.

## Data classes

### Candidate-linked data

- candidate profile fields
- application records
- resume upload references
- candidate consent records
- saved jobs and application history
- support messages

### Employer-linked data

- employer organization profile
- team member records
- job postings
- applicant review state
- moderation/audit actions
- billing/plan references when enabled

### Operator/runtime data

- `jobs`
- `jobQueue`
- `jobResults`
- `logs`
- retry/cancel/dead-letter actions
- actor IDs and timestamps
- worker output references

## Export request workflow

1. User submits export request from account settings or support.
2. Verify the requester's identity.
3. Determine role scope: candidate, employer member, admin/operator.
4. Collect exportable documents by UID/org membership.
5. Exclude secrets, service URLs, private system logs unrelated to the requester, and other users' data.
6. Generate JSON export and optional human-readable summary.
7. Store export in a private signed-download location with expiry.
8. Write an audit log entry.
9. Notify requester that export is ready.

## Deletion request workflow

1. User submits deletion request from account settings or support.
2. Verify identity and ownership.
3. Identify whether retention obligations require partial retention of operational/audit records.
4. Delete or anonymize candidate/employer profile records.
5. Remove or detach resume/artifact references where allowed.
6. Preserve minimal operational audit records where required for security, fraud prevention, incident response, or legal compliance.
7. Write a deletion audit record.
8. Notify requester when complete.

## Firestore collections to review

- `users`
- `jobs`
- `jobQueue`
- `jobResults`
- `logs`
- `candidateProfiles`
- `applications`
- `employerOrganizations`
- `jobPosts`
- `notifications`
- `auditLogs`

Some collections may not exist yet. Add them as marketplace workflows are implemented.

## Minimum launch UI requirements

- Privacy page links to export/deletion support flow.
- Terms page explains operational limitations and authorized use.
- Application flow includes candidate consent.
- Employer flow includes posting and applicant review responsibilities.
- Support contact is visible.

## Support SLA

Initial launch target:

- Acknowledge request within 7 days.
- Complete ordinary export/deletion request within 30 days.
- Escalate complex/legal/abuse/security requests to admin review.

## Audit record shape

```json
{
  "type": "data_export_requested",
  "actorUid": "uid",
  "targetUid": "uid",
  "status": "PENDING",
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp",
  "notes": "Support reference only, no secrets"
}
```

## Privacy constraints

Never export:

- Firebase ID tokens
- passwords
- webhook signing secrets
- private service URLs
- unrelated users' records
- raw internal stack traces not needed for user transparency
- credentials or API keys

## Current implementation boundary

The safe request/control plane is implemented in `functions/src/privacy/dataRights.ts` and exported from the Functions entrypoint.

Implemented now:

- authenticated export/deletion request intake;
- optional `idempotencyKey` (8–128 ASCII letters/digits/._:-), scoped to the authenticated owner; concurrent identical retries return one request, changed payloads reject with `already-exists`;
- owner-scoped request readback;
- admin/operator request listing;
- server-only Firestore request and audit records, created atomically in one batch;
- declared status/createdAt composite index for filtered operator listing (requires index deployment);
- explicit `PROTECTED_STAGING_EXECUTOR_SOURCE_READY_HARD_OFF` execution state;
- deployment precheck coverage for the callable exports and Firestore protection.

Protected-staging executor source now exists in `functions/src/privacy/dataRightsExecution.ts`.

Implemented but hard-off:

- admin/operator-only execution of explicitly APPROVED requests;
- exact protected-staging project admission through server-owned environment configuration;
- explicit rejection if production authorization is enabled;
- retention-decision receipt requirement before execution;
- bounded owner-scoped Jobs export with recursive secret/token redaction, deterministic SHA-256, and private GCS artifact creation;
- bounded Jobs-scope deletion/anonymization for owner-bound jobs, job logs, and queue records;
- explicit unresolved-domain reporting for Firebase Auth, provider derivatives, external artifacts, and data owned by other URAI systems;
- retryable execution receipts and failure state;
- no path that marks the ecosystem request globally COMPLETED.

Still not activated:

- protected-staging deployment/E2E admission;
- central Privacy orchestration and final completion authority;
- provider-side deletion propagation;
- completion notification delivery;
- backup/restore certification;
- legal/privacy approval of retention mappings.

Request intake or Jobs-scope execution must not be interpreted as completed ecosystem export/deletion.

## Remaining implementation tasks

- Execute protected-staging E2E against the exact candidate and retain artifact/readback/failure receipts.
- Integrate central Privacy orchestration and final completion authority.
- Add provider deletion propagation where applicable.
- Add completion notification delivery.
- Add retention/TTL evidence and backup/restore drill receipt.
- Add admin review UI if the operator console does not already expose the request queue.

## Dormant request-record export preparation

`prepareDataRightsRequestExport` is internal source preparation for the exact request/audit collections registered by Privacy. It is not exported as a callable, attached to a trigger, or admitted as a runtime job. It does not complete a request or deliver a download. Broader candidate/employer/jobs/queue/provider data is not covered and `crossSystemComplete` remains false.

Preparation queries records for the server-supplied owner UID, checks ownership again, paginates both registered collections, exports only allowlisted receipt fields, and returns counts plus a deterministic payload SHA-256. Notes, fingerprints, actor identities, unknown fields and credentials are omitted. Unregistered schemas, source failures and the 10,000-record bound fail the entire preparation rather than return a successful partial payload.

The protected executor consumes only an authenticated admin/operator request that has already reached APPROVED state and carries a retention decision receipt. It remains source-ready but runtime-hard-off until protected staging admission and central Privacy orchestration evidence exist.
