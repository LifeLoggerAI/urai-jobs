# UrAi Jobs architecture and cross-service interfaces

**Implemented source:** `functions/src/jobs/createJob.ts`, `executeJob.ts`, queue/retry and cancellation handlers implement internal job admission, lease-dispatched workers, owner/tenant binding, status, outbox and lifecycle controls. `functions/src/index.ts` exports internal Jobs/rights/Life Movie handlers; retained `marketplace/functions/` is historical scaffolding and not automatically the live API.

**Private movie path:** Studio produces a consent-bound plan and sources. `functions/src/jobs/studioLifeMovieBridge.ts` and `studioLifeMovieLongformBridge.ts` validate protected status/plan/children/assembly binding. Studio worker `workers/studio-worker/index.js` has real local FFmpeg construction code; its `lifeMovieConsentAuthorityAvailable()` is `false` and `workers/studio-worker/private-output-write-authority.js` returns `false`. The private output write path remains intentionally shut off. `functions/src/privacy/lifeMovieWriteReservationsReview.ts` is explicitly emulator-only; it does not enforce GCS writes.

**Privacy & rights:** `lifeMovieConsentGate.ts`, `lifeMovieCreationAdmission.ts`, `lifeMovieTrustedAdmission.ts` and dedicated token-provider structures define future trusted positive admission. `lifeMovieDerivativeRevocation.ts` implements owner/consent fencing, pinned generation deletion and point-in-time inventory; it expressly cannot prevent a future privileged upload. Live protected delivery rejects old signed-URL playback and download methods; authenticated 'deliver' request validation is not an active grant.

**Cross-repositories:** Privacy #236 original four-emulator negative/scoped-review issuer exercises Jobs #320; Studio #179 original client exercised real Jobs Functions emulator over HTTP; Spatial #2069 reports 43-case fictional four-emulator owner/consent negative accepted proof while private movie playback remains closed. See [evidence](05_VERIFICATION_AND_EVIDENCE.md).

**Deployment:** canonical `.github/workflows/urai-jobs-production-deploy.yml` explicitly refuses Studio worker activation under Jobs P0 #252, and worker IAM check exits nonzero until approved scoped broker Storage authority exists. A GitHub failed/green workflow summary alone is not release certification.

**Project mappings:** Firebase `urai-4dc1d` is a known wider UrAi project, but never treat a named project or one repo's configuration as proof of a current deployed Jobs/Studio production lineage. Confirm separately with authorized deployment/source/IAM evidence; no production mapping asserted here.
