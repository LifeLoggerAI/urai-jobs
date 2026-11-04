# R573 — Synthetic revocation deletion acknowledgement hard denial

**Status: REVIEW ONLY. Real GCS physical write-fence absent. Genesis HOLD.**

Parent: Jobs draft #263 at exact commit `64f3bfbc6bfef822c5f17e6d5ed6f665c0fd3e3d`. This isolated two-source-file hardening has no production worker, IAM, Firebase Rules, real consent issuer, bucket, deploy or merge change.

## Corrected semantic divergence

The original #255 pure transition model used `REVOKING` and allowed a positive `REVOKED` state when a caller submitted untrusted booleans labeled `independentlyVerified`, `oldWriterIamDenied`, `storageAllApprovedBucketsEmpty`, and `noOutstandingUploadTokens`. That conflicted with the stricter #254 Firestore review emulator which already models `OPEN -> FENCING`, never emits completed revocation, and never grants deletion ACK. It is **not a demonstrated production bypass**, but was an unsound precedent for a future signed broker.

R573 aligns the pure model to `OPEN -> FENCING`, rejects tampered pre-acknowledged or forged REVOKED snapshots and incompatible model schema versions, permits only synthetic `REVIEW_ONLY_SETTLED` bookkeeping, and **always DENIES `acknowledge`** even with zero reservations and an all-true caller-asserted proof. The review model never transitions to REVOKED. Added negative tests cover forged REVOKED snapshots, all-green fabricated proof, invalid fencing/epoch states, duplicate revocation and settled attempts without actual GCS attestation.

Real production ACK requires an independent reviewed privileged **sole-writer** runtime, actual effective GCS IAM policy and historical identity-denial tests, durable stream closure/abort, exact object-generation reconciliation, all approved-bucket inventory, post-withdrawal old-credential and signed-URL denial, source-bound owner C6 and rights, plus protected CI/human approval. None exists merely because this model is green.

## Verification

Run `node --test scripts/life-movie-writer-fence-race-model.test.mjs`, `npm run urai-jobs:verify`, full original frozen build/typecheck, and optionally the original two Firebase review emulator suites on a credential-free disposable test host. The existing `workers/studio-worker/private-output-write-authority.js` MUST remain byte-identical with `return false`. This is **not** a production broker activation. Jobs P0 #252 and Genesis G0–G7 stay HOLD/NO-GO; no real-world media writes, IAM mutation, protected deployment, merge or owner release grant.
