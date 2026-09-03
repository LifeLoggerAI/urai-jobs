# Job Lifecycle Proof

Starting SHA: 9ad2137c2689e6aa936e72b0552a0a1913981714
Branch: production-lock-jobs-2026-06-30

| Step | Status | Evidence |
|---|---|---|
| create | CODE-PRESENT | `createJob` callable creates job doc. |
| enqueue | CODE-PRESENT | `createJob` creates queue doc. |
| lease | CODE-PRESENT | `processQueueTick` and `processQueueNow`. |
| publish | CODE-PRESENT | queue processors publish execution message. |
| receive execution message | CODE-PRESENT | `executeJob` topic handler. |
| validate lease token | CODE-PRESENT | `executeJob` checks stored token. |
| RUNNING transition | CODE-PRESENT | `executeJob` writes RUNNING to job and queue. |
| real worker call | PARTIAL | code calls configured URL; live worker proof unavailable. |
| worker auth | CODE-PRESENT | token auth added to narrator worker route. |
| worker processing | CODE-PRESENT | narrator worker uses TTS and GCS. |
| artifact/result persistence | PARTIAL | code writes result; real GCS object proof unavailable. |
| SUCCESS/DONE transition | CODE-PRESENT | `executeJob` writes SUCCESS and queue DONE. |
| logs/audit | CODE-PRESENT | create, execute, cancel, retry logs exist. |
| status query | CODE-PRESENT | get/list functions exist. |
| retry | CODE-PRESENT | expired lease retry and admin retry. |
| fail/dead | PARTIAL | failed path exists; dead path needs live proof. |
| admin retry | CODE-PRESENT | `retryJobV2`. |
| cancel | CODE-PRESENT | `cancelJob`. |
| dashboard observe | CODE-PRESENT | Admin UI calls live API. |
| drain | CODE-PRESENT | `processQueueNow`. |
| DLQ replay | CODE-PRESENT | scripts exist; live proof unavailable. |
| rollback | CODE-PRESENT | rollback scripts exist; live proof unavailable. |

No live stage is marked READY because provider execution was not available.
