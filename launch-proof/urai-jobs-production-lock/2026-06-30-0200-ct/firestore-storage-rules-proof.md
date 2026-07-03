# Firestore / Storage Rules Proof

Starting SHA: 9ad2137c2689e6aa936e72b0552a0a1913981714
Branch: production-lock-jobs-2026-06-30

## Source-level status

- Firestore `users/{uid}` read is owner/admin only; client create/delete are denied.
- Firestore `jobs/{jobId}` read is owner/admin only; client writes are denied.
- Firestore `jobs/{jobId}/logs/{logId}` read is owner/admin only; client writes are denied.
- Firestore `jobQueue/{jobId}` read/write is denied to clients.
- Default Firestore document access is denied.
- Firebase config references `storage.rules`, but deployed Storage rule status was not verified in this pass.

## Required external proof

- Deploy rules to target project.
- Run rules tests for owner, admin, unauthenticated, and unrelated user access.
- Verify GCS bucket IAM and object access policy for generated artifacts.
