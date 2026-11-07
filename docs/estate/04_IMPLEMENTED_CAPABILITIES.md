# Implemented Jobs capabilities — exact source, not mere aspirations

On Jobs review source `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`: internal job creation, owner/tenant admission, durable queue execution, worker leases, cancellation, idempotency, status, terminal/outbox events and restricted storage/read paths exist in `functions/src/jobs/`, `functions/src/core/`, `workers/`, Firestore rules and supporting tests. Studio Life Movie contracts, source/scene authority binding, FFmpeg render/assembly logic, generation-pinned artifact metadata and privacy-driven revocation code also exist.

**Source boundaries:** Jobs `functions/src/privacy/lifeMovieConsentGate.ts` returns `false` from `lifeMovieConsentAuthorityAvailable()`, so positive private movie admission remains deferred. Studio worker `workers/studio-worker/index.js` independently returns `false` for consent availability. The worker `private-output-write-authority.js` explicitly refuses Storage private output writes; source cannot be enabled by a caller receipt or environment switch. A review-only Firestore reservation model exists but is explicitly not connected to production storage IAM. These are built, intentional DENY controls.

The current private delivery contract validates request shape but is not authenticated playback authorization; old 5-minute signed URL playback/download routes are refused by bridge routing. `functions/src/privacy/lifeMovieDerivativeRevocation.ts` handles bounded known-generation cleanup/invalidation, not a durable real-cloud post-withdrawal sole-writer denial. Career marketplace archived scaffolding exists but is not necessarily exported live.

The distinction is implemented code vs positive production authorization. The system is built and actively tested but cannot yet safely admit live real private movie rendering.

Source identities and module hashes are in `MANIFEST.json` and the source-linked history/architecture docs. Production release remains HOLD.
