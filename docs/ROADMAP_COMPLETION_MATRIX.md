# URAI-Jobs Roadmap Completion Matrix

This matrix summarises the completion status of URAI-Jobs across its five roadmap tiers.  It distinguishes between features that are **implemented**, **partial**, or **not started** at the repository level.  Production verification and deployment evidence are tracked separately.

## Tier 1 – Launch-safe job runtime

| Capability | Status | Notes |
| --- | --- | --- |
| Job creation & validation | **Implemented** | `createJob` ensures authenticated users and writes job/queue docs in a transaction. |
| Job execution & dispatch | **Implemented (fallback only)** | `executeJob` triggers workers or inline fallback; real worker URLs must be configured.  Fallback exposes payload and public GCS URLs. |
| Admin & operator functions | **Implemented** | List, retry, cancel jobs and view logs; only for operators. |
| Basic UI surfaces | **Partial** | Create job page exists; no job list or detail pages for users/operators. |
| CI & build scripts | **Partial** | Many scripts exist but rely on missing secrets and environment config. |
| Security & privacy | **Incomplete** | Payload echo, public buckets, missing RBAC collections. |
| Tests & smoke verification | **Missing** | Scripts are present but not run; no unit or integration tests. |

## Tier 2 – Personalised career intelligence

| Capability | Status | Notes |
| --- | --- | --- |
| Profile & resume ingestion | **Partial** | Career Mirror page stores preferences locally; no backend profile store. |
| Skill extraction & matching | **Not started** | Worker stubs return stubbed results; no matching algorithm. |
| Saved jobs & searches | **Not started** | Not implemented. |
| Application tracking | **Not started** | No concept of job applications. |
| Analytics events | **Partial** | `trackJobsEvent` used in frontend; not connected to analytics service. |
| Job ingestion pipeline | **Not started** | No integration with B2B portal or external job postings. |

## Tier 3 – URAI ecosystem integration

| Capability | Status | Notes |
| --- | --- | --- |
| URAI identity/profile integration | **Not started** | Only Firebase Auth used; no URAI identity API. |
| Spatial, studio, narrator, asset integrations | **Stubbed** | Job registry lists these types; workers missing; fallback used. |
| Analytics integration | **Not started** | No ingestion to `urai-analytics`. |
| Admin portal integration | **Not started** | URAI-Jobs admin functions not linked to URAI Admin portal. |
| B2B portal integration | **Not started** | No employer/job posting features. |
| Consent & privacy controls | **Not started** | No explicit consent flows. |

## Tier 4 – Autonomous career agent layer

| Capability | Status | Notes |
| --- | --- | --- |
| AI job scout & monitoring | **Not started** | No job discovery or monitoring. |
| Resume tailoring & cover letters | **Not started** | Worker stubs exist but no logic. |
| Automated follow-ups & interview prep | **Not started** | Only stubs for `career.followup.plan` and `career.interview.prep`. |
| Career trajectory modelling | **Not started** | None. |
| User autonomy & consent controls | **Not started** | Not implemented. |

## Tier 5 – Full system-of-systems engine

| Capability | Status | Notes |
| --- | --- | --- |
| Real-time opportunity graph | **Not started** | No graph or ingestion pipeline. |
| Verified provider network & enterprise insights | **Not started** | No provider onboarding or analytics. |
| Spatial/mixed reality visualisation | **Not started** | Spatial worker stub; no 3-D visualisation. |
| Cross-platform URAI integration | **Not started** | Jobs runtime not integrated with other URAI domains. |
| Production-grade observability & governance | **Not started** | Minimal logs; no centralised metrics, tracing, or compliance. |
| Versioning & migration support | **Not started** | No versioned APIs or migration scripts.

---

This matrix is subject to update as implementation proceeds.  “Not started” indicates no code exists; “Partial” denotes scaffolding or stubs; “Implemented” denotes working code in the repository but not necessarily production-verified.
