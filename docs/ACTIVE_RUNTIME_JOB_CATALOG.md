# URAI Jobs active runtime job catalog

Generated authority source: `functions/src/core/runtimeJobTypes.ts`.

This catalog documents **admitted runtime types only**. Historical/future types elsewhere in the repository are not active merely because a schema or old registry entry exists.

| Job type | Owner / worker boundary | Worker configuration | Runtime status |
| --- | --- | --- | --- |
| `narrator.tts` | URAI Jobs / Narrator worker | `NARRATOR_WORKER_URL`, `/execute-job` | admitted |
| `asset-render` | Asset Factory / Asset worker | `ASSET_WORKER_URL`, `/` | admitted legacy alias |
| `asset.render` | Asset Factory / Asset worker | `ASSET_WORKER_URL`, `/` | admitted |
| `studio.render.video` | URAI Studio / Life Movies worker | `STUDIO_WORKER_URL`, `/` | admitted with Life Movies payload/tenant contract |
| `studio.assemble.video` | URAI Studio / Life Movies worker | `STUDIO_WORKER_URL`, `/` | admitted only through authenticated long-form bridge |
| `communications.message.send` | URAI Communications / Communications worker | `COMMUNICATIONS_WORKER_URL`, `/executeJob` | admitted with tenant/message contract |
| `memory.private-source.transcribe` | URAI Jobs / Private-source worker | `PRIVATE_SOURCE_WORKER_URL`, `/execute-job` | admitted with consent + opaque source receipt contract |
| `memory.private-source.index` | URAI Jobs / Private-source worker | `PRIVATE_SOURCE_WORKER_URL`, `/execute-job` | admitted with consent + private memory-graph / scene-truth receipt contract |
| `memory.private-source.reconstruct-place` | URAI Jobs / Captured Reality worker | `CAPTURED_REALITY_WORKER_URL`, `/execute-job` | admitted with dual-consent + exact reconstruction provenance contract |
| `web.search` | URAI Jobs / governed TinyFish provider adapter | inline provider adapter; no worker URL | admitted with bounded retrieval contract |
| `web.fetch` | URAI Jobs / governed TinyFish provider adapter | inline provider adapter; no worker URL | admitted with bounded retrieval contract |
| `web.agent` | URAI Jobs / governed TinyFish provider adapter | inline provider adapter; no worker URL | admitted only with explicit paid-run authorization |

## Fail-closed rule

`createJob` must call `isActiveRuntimeJobType` before creating a queue record. A type absent from the active runtime registry is rejected as unsupported/inactive.

`executeJob` derives worker environment keys and routes from the same runtime registry. Missing mappings do not silently route to Narrator or another unrelated worker.

The catalog is verified against the canonical registry by `scripts/runtime-job-catalog-contract.mjs`. A registry type missing here, or a catalog job type not present in the registry, is a CI failure.

Future/career/spatial/content/storytime/analytics/admin/deployment/proof families remain inactive unless they are deliberately added to the canonical runtime registry with their owning contract and exact-head proof.
