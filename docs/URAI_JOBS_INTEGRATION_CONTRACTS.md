# URAI Jobs: Integration Contracts

This document specifies the official job types and their expected payload/output contracts for the URAI-JOBS system.

---

## 1. Spatial Subsystem

### `spatial.memory.snapshot`
- **Owner:** `urai-spatial`
- **Payload Shape:** `{ "sessionId": string, "sceneId": string, "cameraTransform": object }`
- **Output Shape:** `{ "snapshotUrl": string, "assetId": string }`
- **Status States:** `PENDING`, `RUNNING`, `SUCCESS`, `ERROR`
- **Retry Behavior:** 3 retries with exponential backoff.
- **Failure Behavior:** Marks job as `ERROR` and logs failure reason.

### `spatial.replay.render`
- **Owner:** `urai-spatial`
- **Payload Shape:** `{ "sessionId": string, "format": "mp4" | "gif", "resolution": string }`
- **Output Shape:** `{ "renderUrl": string, "duration": number }`
- **Status States:** `PENDING`, `RUNNING`, `SUCCESS`, `ERROR`
- **Retry Behavior:** 1 retry. Long-running job.
- **Failure Behavior:** Marks job as `ERROR`.

## 2. Marketing Subsystem

### `marketing.demo.session`
- **Owner:** `urai-marketing`
- **Payload Shape:** `{ "userId": string, "templateId": string }`
- **Output Shape:** `{ "demoSessionUrl": string, "expires": string }`
- **Status States:** `PENDING`, `RUNNING`, `SUCCESS`, `ERROR`
- **Retry Behavior:** 2 retries.
- **Failure Behavior:** Logs and alerts marketing team.

### `marketing.sharecard.generate`
- **Owner:** `urai-marketing`
- **Payload Shape:** `{ "contentId": string, "platform": "twitter" | "linkedin", "userId": string }`
- **Output Shape:** `{ "imageUrl": string }`
- **Status States:** `PENDING`, `RUNNING`, `SUCCESS`, `ERROR`
- **Retry Behavior:** 3 retries.
- **Failure Behavior:** Marks as `ERROR`.

## 3. Studio Subsystem

### `studio.asset.render`
- **Owner:** `urai-studio`
- **Payload Shape:** `{ "assetId": string, "renderProfile": "high" | "low" }`
- **Output Shape:** `{ "renderUrls": { "preview": string, "full": string } }`
- **Status States:** `PENDING`, `RUNNING`, `SUCCESS`, `ERROR`
- **Retry Behavior:** No automatic retry. User-initiated.
- **Failure Behavior:** Marks as `ERROR`, notifies user.

### `assetFactory.asset.generate`
- **Owner:** `asset-factory`
- **Payload Shape:** `{ "type": "character" | "environment", "prompt": string, "params": object }`
- **Output Shape:** `{ "assetId": string, "previewUrl": string }`
- **Status States:** `PENDING`, `RUNNING`, `SUCCESS`, `ERROR`
- **Retry Behavior:** 1 retry.
- **Failure Behavior:** Marks as `ERROR`.

## 4. Analytics Subsystem

### `analytics.enrichment.run`
- **Owner:** `analytics`
- **Payload Shape:** `{ "dataType": "user" | "session", "dataId": string }`
- **Output Shape:** `{ "enrichmentStatus": "complete", "updatedFields": string[] }`
- **Status States:** `PENDING`, `RUNNING`, `SUCCESS`, `ERROR`
- **Retry Behavior:** 5 retries with backoff.
- **Failure Behavior:** Logs to dead-letter queue.

## 5. Communications Subsystem

### `communications.message.send`
- **Owner:** `communications`
- **Payload Shape:** `{ "channel": "email" | "sms", "recipient": string, "templateId": string, "vars": object }`
- **Output Shape:** `{ "messageId": string, "deliveryStatus": "sent" }`
- **Status States:** `PENDING`, `RUNNING`, `SUCCESS`, `ERROR`
- **Retry Behavior:** 3 retries.
- **Failure Behavior:** Alerts communications team.

## 6. Privacy Subsystem

### `privacy.export.run`
- **Owner:** `privacy/consent`
- **Payload Shape:** `{ "userId": string, "format": "json" | "csv" }`
- **Output Shape:** `{ "exportUrl": string, "expires": string }`
- **Status States:** `PENDING`, `RUNNING`, `SUCCESS`, `ERROR`
- **Retry Behavior:** 2 retries.
- **Failure Behavior:** Critical alert to legal/privacy team.

### `privacy.delete.run`
- **Owner:** `privacy/consent`
- **Payload Shape:** `{ "userId": string }`
- **Output Shape:** `{ "deletionConfirmationId": string, "deletedAt": string }`
- **Status States:** `PENDING`, `RUNNING`, `SUCCESS`, `ERROR`
- **Retry Behavior:** No automatic retries. Manual intervention required.
- **Failure Behavior:** Critical alert to legal/privacy team.

## 7. Storytime Subsystem

### `storytime.story.generate`
- **Owner:** `storytime`
- **Payload Shape:** `{ "prompt": string, "characterIds": string[], "length": number }`
- **Output Shape:** `{ "storyId": string, "textUrl": string, "audioUrl": string }`
- **Status States:** `PENDING`, `RUNNING`, `SUCCESS`, `ERROR`
- **Retry Behavior:** 1 retry.
- **Failure Behavior:** Marks as `ERROR`.

## 8. Admin Subsystem

### `admin.review.queue`
- **Owner:** `admin`
- **Payload Shape:** `{ "queueName": string, "filter": object }`
- **Output Shape:** `{ "itemsForReview": object[] }`
- **Status States:** `PENDING`, `RUNNING`, `SUCCESS`, `ERROR`
- **Retry Behavior:** 2 retries.
- **Failure Behavior:** Marks as `ERROR`.
