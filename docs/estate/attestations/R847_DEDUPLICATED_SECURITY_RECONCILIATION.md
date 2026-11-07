# R847 — complete selected 65-file security-byte cohort; deduplicated coverage

**Source candidate:** Jobs PR #320 `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`, tree `3e74b4b0d6e10df15f9ccd747e9e936218b7fc25`. **Evidence branch:** Jobs draft PR #324, documentation only.

## Evidence
- R846_PART_01.json: 18 / 18 file instances verified (90,177 bytes).
- R846_PART_02.json: 16 / 16 verified (160,944 bytes).
- R846_PART_03.json: 16 / 16 verified (110,346 bytes).
- R847_HIGH_RISK_BATCH_04.json: 15 / 15 verified (121,277 bytes).
- **Deduplicated cumulative coverage: 65 / 1,177 tracked paths, 65 distinct Git blobs, 482,744 raw bytes, 0 mismatches; 1,112 paths remaining.**
- The R845 original byte proof (1,011-byte `workers/studio-worker/private-output-write-authority.js`) is **the same path and blob** re-verified by R847 batch 04, so it contributes **zero additional unique files or bytes**. Its SHA-256 `a8a1a6fa86574bed3f1e2d9c7db305a12b3f238c066d37c023be199720cf6075` matches R847's independently recomputed value.

## Security code semantics inspected against exact source

1. `functions/src/privacy/lifeMovieWriteReservationsReview.ts` (source blob `88126bbbcff6188b9c3d8f1aadda84b33404dacd`): explicitly **emulator-only** Firestore transaction and shared revocation-epoch prototype. It denies production authorization, GCS upload tokens, and deletion acknowledgement. Its test ledger does **not** prove active network-transfer drainage or final object-generation absence.
2. `workers/studio-worker/private-output-write-authority.js` (blob `ea6b25f3949ec2c17f65a9da68fa9cf937e86e76`): `privateOutputWriteAuthorityAvailable()` returns `false` unconditionally and `assertPrivateOutputWriteAuthority()` throws. No flag can enable it. **Preserve this guard.**
3. `functions/src/jobs/lifeMoviePrivateDeliveryContract.ts` (blob `bfe1e7600715bb8e0f2dd696876dd86d3d0a4ce4`): robust request-shape validation expressly does **not** grant authorization; `authorityHash` is caller-controlled, and protected streaming stays closed pending server-owned verifier.
4. `storage.rules` (blob `eedbbe45545ecd09d8867c9d702cd00bb3b7d7be`): client writes to job/export/evidence/tmp prefixes are denied and rules default-deny, but privileged Admin SDK / service-account GCS credentials bypass client Storage Rules. Therefore this file **cannot independently certify broker-only sole-writer IAM or post-revocation no-write**.

## Remaining engineering acceptance, separate from hashing

Jobs #252 P0 remains open. A production-equivalent broker-only IAM principal and durable epoch reservation/fence must block stale uploads even after an old writer passes a preflight, and revocation acknowledgement must await real generation reconciliations. Positive signed C6/owner rights, real protected Replay, end-to-end deletion, full-device acceptance and authorized release are not proved by these records. Original negative/fail-closed native worker results must not be promoted into positive release certificates.

## Next-work exact checkpoint

- The selected 65 high-risk paths are now fully attested at raw-byte level; do not repeat those as new unique coverage.
- Next use the R845 `docs/estate/MANIFEST.json` pinned manifest, **subtract all 65 verified path IDs**, and prioritize unverified media/auth/handler and test paths. Keep per-blob SHA-1, independently recomputed SHA-256, size and explicit failure receipts, with counts deduplicated by path and blob.
- Then verify full history, refs, unreachable Git objects, LFS/external payloads, and production IAM separately.
- Do not modify application code, enable writes, merge, deploy, change billing, or claim release GO.

**Genesis production HOLD.**
