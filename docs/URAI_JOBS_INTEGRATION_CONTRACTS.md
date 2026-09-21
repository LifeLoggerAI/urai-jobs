# URAI Jobs: Integration Contracts

This document specifies the official job families and payload/output contracts for the URAI Jobs internal runtime.

## Canonical runtime statuses

All subsystem integrations must use the canonical runtime statuses below. Legacy `ERROR` language means `FAILED` and should not be emitted by new integrations.

```text
PENDING, LEASED, RUNNING, SUCCESS, FAILED, DEAD, CANCELLED
```

General lifecycle:

```text
PENDING -> LEASED -> RUNNING -> SUCCESS
PENDING -> LEASED -> RUNNING -> FAILED -> PENDING/SUCCESS/DEAD
PENDING/LEASED/RUNNING -> CANCELLED
```

## Shared integration requirements

- Jobs must be created through authorized Firebase callable functions, not direct client writes.
- Production and staging jobs must call configured workers. Inline fallback is local/emulator-only and is not production proof.
- Workers must authenticate requests through Cloud Run IAM or `Authorization: Bearer <URAI_JOBS_WORKER_TOKEN>`.
- Workers must return structured results and avoid logging secrets or private payload contents unnecessarily.
- Artifacts must be persisted to an approved GCS bucket or another explicitly documented artifact store.

---

## 1. Spatial subsystem

### `spatial.memory.snapshot`
- **Owner:** `urai-spatial`
- **Payload Shape:** `{ "sessionId": string, "sceneId": string, "cameraTransform": object }`
- **Output Shape:** `{ "snapshotUrl": string, "assetId": string }`
- **Status States:** canonical runtime statuses only.
- **Retry Behavior:** 3 retries with backoff.
- **Failure Behavior:** Marks job as `FAILED`; retries or dead-letter handling must be visible in logs.

### `spatial.replay.render`
- **Owner:** `urai-spatial`
- **Payload Shape:** `{ "sessionId": string, "format": "mp4" | "gif", "resolution": string }`
- **Output Shape:** `{ "renderUrl": string, "duration": number }`
- **Status States:** canonical runtime statuses only.
- **Retry Behavior:** 1 retry. Long-running job.
- **Failure Behavior:** Marks job as `FAILED`.

## 2. Marketing subsystem

### `marketing.demo.session`
- **Owner:** `urai-marketing`
- **Payload Shape:** `{ "userId": string, "templateId": string }`
- **Output Shape:** `{ "demoSessionUrl": string, "expires": string }`
- **Status States:** canonical runtime statuses only.
- **Retry Behavior:** 2 retries.
- **Failure Behavior:** Logs failure and marks job as `FAILED`.

### `marketing.sharecard.generate`
- **Owner:** `urai-marketing`
- **Payload Shape:** `{ "contentId": string, "platform": "twitter" | "linkedin", "userId": string }`
- **Output Shape:** `{ "imageUrl": string }`
- **Status States:** canonical runtime statuses only.
- **Retry Behavior:** 3 retries.
- **Failure Behavior:** Marks job as `FAILED`.

## 3. Studio / asset subsystem

### `studio.asset.render`
- **Owner:** `urai-studio`
- **Payload Shape:** `{ "assetId": string, "renderProfile": "high" | "low" }`
- **Output Shape:** `{ "renderUrls": { "preview": string, "full": string } }`
- **Status States:** canonical runtime statuses only.
- **Retry Behavior:** no automatic retry unless explicitly configured for the job.
- **Failure Behavior:** Marks job as `FAILED`; user notification is handled by the calling subsystem.

### `assetFactory.asset.generate`
- **Owner:** `asset-factory`
- **Payload Shape:** `{ "type": "character" | "environment", "prompt": string, "params": object }`
- **Output Shape:** `{ "assetId": string, "previewUrl": string }`
- **Status States:** canonical runtime statuses only.
- **Retry Behavior:** 1 retry.
- **Failure Behavior:** Marks job as `FAILED`.

## 4. Analytics subsystem

### `analytics.enrichment.run`
- **Owner:** `analytics`
- **Payload Shape:** `{ "dataType": "user" | "session", "dataId": string }`
- **Output Shape:** `{ "enrichmentStatus": "complete", "updatedFields": string[] }`
- **Status States:** canonical runtime statuses only.
- **Retry Behavior:** 5 retries with backoff.
- **Failure Behavior:** Marks job as `FAILED`; `DEAD` is reserved for exhausted or manually dead-lettered work.

## 5. Communications subsystem

### `communications.message.send`
- **Owner:** `communications`
- **Authority:** `tenantId` and `ownerUid` come only from the authenticated server-side Jobs user record. Callers cannot choose the tenant.
- **Payload Shape:** `{ "channel": "email", "templateId": "template_...", "recipientUid": string, "vars": object, "urgency"?: "normal" | "urgent" }`
- **Forbidden Payload Fields:** raw recipient addresses, phone numbers, email addresses, recipient hashes supplied as destination authority, tenant IDs, provider credentials, provider IDs.
- **Destination / channel authority:** current Jobs integration admits only email. Communications resolves the tenant-owned recipient record and hashes the server-owned email internally; the active tenant-owned template must also resolve to email or the worker fails closed.
- **Worker route:** `COMMUNICATIONS_WORKER_URL + /executeJob` (Firebase HTTPS function export).
- **Output Shape after real provider submission:** `{ "messageId": string, "deliveryId": string, "deliveryStatus": "submitted" | later provider-terminal state, "testMode": false }`
- **Current provider boundary:** Communications itself requires `ENABLE_REAL_DELIVERY=true`, configured reviewed provider secrets, and a valid shared Jobs bearer secret before it will attempt a provider send. Otherwise it fails closed; Jobs must not treat a simulated/no-provider outcome as success.
- **Status States:** canonical runtime statuses only.
- **Retry Behavior:** 3 retries at the Jobs layer; idempotency binds owner + tenant + job type + payload fingerprint.
- **Failure Behavior:** invalid tenant/template/recipient/consent state fails closed and the Jobs execution records `FAILED`; Communications owns the delivery log/audit receipt.

## 6. Privacy subsystem

### `privacy.export.run`
- **Owner:** `privacy/consent`
- **Payload Shape:** `{ "userId": string, "format": "json" | "csv" }`
- **Output Shape:** `{ "exportUrl": string, "expires": string }`
- **Status States:** canonical runtime statuses only.
- **Retry Behavior:** 2 retries.
- **Failure Behavior:** Marks job as `FAILED`; privacy/legal escalation is required for unresolved failures.

### `privacy.delete.run`
- **Owner:** `privacy/consent`
- **Payload Shape:** `{ "userId": string }`
- **Output Shape:** `{ "deletionConfirmationId": string, "deletedAt": string }`
- **Status States:** canonical runtime statuses only.
- **Retry Behavior:** no automatic retry unless an operator explicitly approves it.
- **Failure Behavior:** Marks job as `FAILED`; unresolved failures require privacy/legal escalation.

## 7. Storytime subsystem

### `storytime.story.generate`
- **Owner:** `storytime`
- **Payload Shape:** `{ "prompt": string, "characterIds": string[], "length": number }`
- **Output Shape:** `{ "storyId": string, "textUrl": string, "audioUrl": string }`
- **Status States:** canonical runtime statuses only.
- **Retry Behavior:** 1 retry.
- **Failure Behavior:** Marks job as `FAILED`.

## 8. Admin subsystem

### `admin.review.queue`
- **Owner:** `admin`
- **Payload Shape:** `{ "queueName": string, "filter": object }`
- **Output Shape:** `{ "itemsForReview": object[] }`
- **Status States:** canonical runtime statuses only.
- **Retry Behavior:** 2 retries.
- **Failure Behavior:** Marks job as `FAILED`.
