# Worker Map

Starting SHA: 9ad2137c2689e6aa936e72b0552a0a1913981714
Branch: production-lock-jobs-2026-06-30

| Worker family | Route / env | Implementation | Status |
|---|---|---|---|
| narrator | NARRATOR_WORKER_URL -> /execute-job | workers/narrator-worker uses Google TTS and GCS | CODE-PRESENT, live proof blocked |
| asset | ASSET_WORKER_URL -> / | no verified dedicated worker in this pass | ROUTED, implementation/live proof blocked |
| spatial | SPATIAL_WORKER_URL -> / | no verified dedicated worker in this pass | ROUTED, implementation/live proof blocked |
| studio | STUDIO_WORKER_URL -> / | no verified dedicated worker in this pass | ROUTED, implementation/live proof blocked |
| career | CAREER_WORKER_URL -> /execute-job | presets/routes present, worker live proof not verified | PARTIAL |
| content | CONTENT_WORKER_URL documented; route support still needs implementation mapping | PARTIAL |
| storytime | STORYTIME_WORKER_URL documented; route support still needs implementation mapping | PARTIAL |
| analytics | ANALYTICS_WORKER_URL documented; route support still needs implementation mapping | PARTIAL |
| communications | COMMUNICATIONS_WORKER_URL documented; route support still needs implementation mapping | PARTIAL |
| admin/operator | Firebase callable functions and web admin console | CODE-PRESENT |
| deployment/proof | scripts exist for deploy, health, rollback, DLQ | CODE-PRESENT, provider proof blocked |

No worker family is marked LIVE because no staging/production Cloud Run execution evidence was available in this completion pass.
