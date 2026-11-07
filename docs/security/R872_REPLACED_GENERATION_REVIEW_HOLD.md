# R872 — replacement-safe physical generation observations (review-only)

**Origin:** Latest exact Jobs R871 #332 source `65a5c6bf83ab18bf2643bf9419e788f30a8055d3`, itself a no-conflict forward-port of R870 onto peer R867 staging audit. This is a separate draft child branch; no existing PR, Studio output worker, IAM, render or deploy has been changed.

## Concrete R870 gap

The R870 review ledger allowed a **historical** idempotent replay when the original Storage object had been deleted and the metadata lookup returned 404. That is correct for a real exact-generation deletion. But it treated a path occupied by a **different currently live generation** as just `storageCurrentlyObserved=false`, returning an idempotent replay without explicitly flagging the unauthorized replacement. For risk tracking after withdrawal, a live replacement is qualitatively different from 404.

## Narrow fix

New dependency-free decision file `functions/src/privacy/lifeMovieGenerationEvidenceReview.ts`, integrated into `lifeMovieWriteReservationsReview.ts`:
- Exact current GCS generation matches the claimed canonical positive uint64 string: report `storageCurrentlyObserved=true`.
- Missing Storage object (strict 404) after a **previously verified** identical observation: allow historical replay with `storageCurrentlyObserved=false` and always `productionAuthorized=false`, `revocationAcknowledgementPermitted=false`.
- Missing object for first-time observation: reject.
- Actual different live generation at same canonical path: reject with `life_movie_review_write_generation_replaced_unverified` for previously verified attempts or `...generation_not_observed` for new attempts. Do not silently treat replacement as deletion.
- Missing/invalid/unsafe-precision provider metadata or contradictory 404 with metadata: reject as `storage_unverified`. Existing Firestore checkedAttempt still requires exact owner/tenant/project/path, epoch, and `storageMetadataReadbackVerified=true` for historical attempts.
- Never convert unsafe uint64 generations through JavaScript `Number`; the original metadata readback is **not atomic** with the Firestore transaction and does not create a true GCS write fence.

Added an original, standalone Node test `scripts/life-movie-generation-evidence-review.test.mjs` (8 cases) and extended the existing Firebase Firestore/Storage native broker test to 9 source-defined checks including actual replacement via the disposable Storage emulator.

## Evidence

Local Node v22.16.0 original standalone test `node --experimental-strip-types --test scripts/life-movie-generation-evidence-review.test.mjs`: **8/8 PASS, exit 0**. TAP output SHA256 `827bf60b9f3361e75359aad7fb3f340b2f330218b1e68b4e9fc55f2ee1d94889`. Local TypeScript `tsc --strict --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext functions/src/privacy/lifeMovieGenerationEvidenceReview.ts`: exit 0. Test JavaScript `node --check`: exit 0. Both exact original GitHub blob SHA readbacks match the local tested bytes: helper `bfed42965f606eb73ff05f2a71fdd7d3135ceda2`, standalone test `308e5b27b35674f7dde2f66093f77e286a027519`.

**Not executed:** full Jobs frozen install, full workspace verification/typecheck/build, updated Firebase emulator broker 9-case suite, original R854 7-stage negative suite, production-equivalent GCS IAM data-plane denial. Current local runtime cannot resolve github.com and does not have mounted Jobs dependencies; no new paid Runpod was launched. The original earlier R854 7/7 and R857 6/6 PASS are not certification for this changed source.

## P0 remains OPEN

The Admin Storage legacy writer bypass after consent withdrawal has been reproduced by prior native emulator tests. Staging GCS denial probe is independent and requires scoped credential approval; no such live probe has run here. Effective old/alternate principal Storage-level HTTP 403, sole signed broker, durable network upload drain, generation absence across all approved buckets, positive owner consent/source rights, protected Replay and device acceptance remain unverified. Keep worker direct private output hard-OFF, no deletion-completion ACK, no production IAM changes and **GENESIS PRODUCTION HOLD**.
