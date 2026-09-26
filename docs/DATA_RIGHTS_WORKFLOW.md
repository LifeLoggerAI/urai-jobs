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
- explicit `HARD_OFF_PENDING_GOVERNED_WORKER` execution state;
- deployment precheck coverage for the callable exports and Firestore protection.

Not yet activated:

- destructive deletion/anonymization execution;
- export package generation/download delivery;
- provider-side deletion propagation;
- completion notification delivery;
- backup/restore certification.

Those operations remain hard-off until the governed worker, retention/legal policy, cross-tenant tests, and recovery evidence exist. Request intake must not be interpreted as completed export/deletion execution.

## Remaining implementation tasks

- Implement governed export worker and private delivery receipt.
- Implement governed deletion/anonymization worker with legal-retention escalation.
- Add provider deletion propagation where applicable.
- Add completion notification delivery.
- Add retention/TTL evidence and backup/restore drill receipt.
- Add admin review UI if the operator console does not already expose the request queue.
