# System‑of‑Systems Integration Map

This map outlines the URAI subsystems that URAI‑Jobs is expected to integrate with, notes whether any integration exists in the repository, and highlights required data contracts and consent boundaries.  It will be updated as integration work proceeds.

| Integration target | Exists? | Evidence/Notes | Required contract | Consent & auth boundaries | Owner repo |
| --- | --- | --- | --- | --- | --- |
| URAI identity & profile | No | Only Firebase Auth is used; no calls to URAI identity services or profile ingestion. | APIs to fetch and update canonical user profile/resume; schema for profile payloads and results. | Users must consent to share resumes and career preferences with URAI; roles & permissions must enforce access. | `UrAi` (core identity) |
| URAI spatial (life‑map / career map) | Stubbed | Job registry lists `spatial.*` job types; no worker implementation; fallback returns placeholder artifact URLs. | HTTP contract to request scene rendering, index generation, and embed link; event schema for spatial events. | Workers must operate on anonymised job payloads; outputs stored in private buckets with signed URLs. | `urai-spatial` |
| URAI studio | Stubbed | Job registry lists `studio.*` job types; no worker implementation. | API contract to request video rendering and export packaging; worker response schema. | Must verify content rights; ensure personal data redacted from video scenes. | `urai-studio` |
| URAI narrator / content | Stubbed | Job registry lists narrator job types; fallback writes transcripts; workers missing. | Schema for TTS synthesis requests and narration exports; audio format specification. | TTS requests may include personal or proprietary text; ensure proper redaction and usage rights. | `urai-content` & `asset-factory` |
| URAI analytics | No | Front‑end calls `trackJobsEvent` but does not send events to analytics service. | Event schema for job lifecycle and UI interactions; ingestion endpoint or Pub/Sub topic. | Must anonymise user identifiers and strip payload details; opt‑in analytics by user. | `urai-analytics` |
| URAI admin portal | No | Admin functions in URAI‑Jobs are internal; not exposed in the central admin portal. | REST/GraphQL API to list, filter, and manage jobs across all URAI systems. | Only users with operator or admin roles may access; per‑subsystem scoping. | `urai-admin` |
| B2B portal | No | There is no employer/job posting interface or integration. | API for employers to post roles and view candidate pipelines; job ingestion specification. | Employer data must be separated from candidate data; candidate visibility controlled by consent. | `B2Bportal` |
| Asset factory & content generation | Stubbed | Asset job types are mapped in the job registry but workers are not implemented; fallback writes JSON manifests. | HTTP or Pub/Sub contract to request asset generation, validation, packaging, publishing; result envelope with manifest and artifact URLs. | Workers must operate in isolated containers; outputs stored privately; access controlled by user and tenant. | `asset-factory` & `urai-content` |
| Cross‑system events & graph | No | There is no event bus integration or global job/skill graph. | Unified event envelope for job lifecycle events; graph update API for opportunity/skill relationships. | Must gate event propagation to authorised subscribers; anonymise PII. | multiple (UrAi foundation) |

---

Integrations listed as “No” or “Stubbed” require cross‑repository coordination to define data contracts, authentication mechanisms, and privacy policies.  As URAI‑Jobs progresses, this map will be expanded with signed schemas and implementation details.
