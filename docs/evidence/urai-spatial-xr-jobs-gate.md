# URAI Spatial XR Jobs Evidence Gate

This file records async-service evidence required before `LifeLoggerAI/urai-spatial` or native XR clients may claim production AR/VR/XR readiness.

## Current status

- Dependency status: `required-before-production-xr`.
- Canonical consumer: `LifeLoggerAI/urai-spatial` and future native XR clients.
- Async surfaces: asset generation, narration/TTS, indexing, sync, export, deletion, moderation, provider callbacks, retries, and scheduled work.
- Production XR claim status: blocked until queue, worker, callable/API, retry/idempotency, DLQ, auth, and monitoring evidence are recorded.

## Required XR jobs evidence

| Gate | Required evidence | Result | Notes |
| --- | --- | --- | --- |
| Worker build/deploy | Cloud Run/Firebase Functions build and deploy evidence | Not recorded | Required before async provider claims. |
| Queue contract | Queue payload schemas and worker routing evidence | Not recorded | Required before long-running XR work. |
| Retry/idempotency | Duplicate delivery, retry, and idempotency proof | Not recorded | Required before provider callbacks and durable jobs. |
| DLQ | Dead-letter queue proof with operator recovery path | Not recorded | Required before production launch. |
| Auth boundary | Callable/API auth and tenant boundary proof | Not recorded | Required before user-owned jobs. |
| Export/deletion jobs | Export and deletion job proof aligned with privacy repo | Not recorded | Required before production launch. |
| Moderation jobs | Moderation/review queue evidence for UGC/provider outputs | Not recorded | Required before marketplace or UGC claims. |
| Monitoring | Job dashboards/log redaction/alert evidence | Not recorded | Required before production launch. |
| Rollback | Rollback SHA/procedure for worker release | Not recorded | Required before production approval. |

## Integration contract for URAI Spatial

`urai-spatial` must keep jobs/provider rows as `Not recorded` or `Not validated` until this repo records:

1. Worker deployment evidence.
2. Queue/DLQ evidence.
3. Retry/idempotency evidence.
4. Auth and tenant boundary evidence.
5. Export/deletion/moderation job evidence.
6. Monitoring and rollback evidence.

## Release decision

Do not use this file to mark jobs production complete by itself. It is a cross-repo XR dependency ledger. Authoritative jobs readiness remains in this repo's CI, deploy, emulator, smoke, and operational evidence files.
