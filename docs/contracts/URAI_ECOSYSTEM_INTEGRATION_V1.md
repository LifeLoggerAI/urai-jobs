# URAI Ecosystem Integration Contract V1

Jobs runtime is the async execution owner for the URAI system chain:
`UrAi -> urai-jobs -> urai-content -> asset-factory -> urai-spatial -> urai-studio -> B2Bportal`

Use `URAI_ECOSYSTEM_SCHEMA_V1.json` for cross-repo entity compatibility.

Jobs-specific obligations:
- Preserve canonical status states: `PENDING`, `LEASED`, `RUNNING`, `SUCCESS`, `FAILED`, `DEAD`, `CANCELLED`.
- Emit stable job records with deterministic `jobType` and result asset references.
- Keep worker outputs compatible with asset-factory and spatial/studio consumers.
- Enforce auth and CORS boundaries for internal runtime endpoints.
