# URAI Jobs active runtime job catalog

Generated authority source: `functions/src/core/runtimeJobTypes.ts`.

This catalog documents **admitted runtime types only**. Historical/future types elsewhere in the repository are not active merely because a schema or old registry entry exists.

| Job type | Owner / worker boundary | Worker configuration | Runtime status |
| --- | --- | --- | --- |
| `narrator.tts` | Narrator worker | `NARRATOR_WORKER_URL`, `/execute-job` | admitted |
| `asset-render` | Asset worker | `ASSET_WORKER_URL`, `/` | admitted legacy alias |
| `asset.render` | Asset worker | `ASSET_WORKER_URL`, `/` | admitted |
| `studio.render.video` | Studio Life Movies worker | `STUDIO_WORKER_URL`, `/` | admitted with Life Movies payload/tenant contract |
| `communications.message.send` | Communications worker | `COMMUNICATIONS_WORKER_URL`, `/executeJob` | admitted with tenant/message contract |
| `memory.private-source.transcribe` | Private-source worker | `PRIVATE_SOURCE_WORKER_URL`, `/execute-job` | admitted with consent + opaque source receipt contract |

## Fail-closed rule

`createJob` must call `isActiveRuntimeJobType` before creating a queue record. A type absent from the active runtime registry is rejected as unsupported/inactive.

`executeJob` derives worker environment keys and routes from the same runtime registry. Missing mappings do not silently route to Narrator or another unrelated worker.

Future/career/spatial/content/storytime/analytics/admin/deployment/proof families remain inactive unless they are deliberately added to the canonical runtime registry with their owning contract and exact-head proof.
