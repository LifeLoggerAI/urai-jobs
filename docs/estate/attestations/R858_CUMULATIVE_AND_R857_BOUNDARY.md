# R858 — source-byte continuation and aborted full-mirror evidence

**Immutable source candidate:** Jobs PR #320 `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`, Git tree `3e74b4b0d6e10df15f9ccd747e9e936218b7fc25`. **Documentation-only review:** Jobs draft #324.

## R858 new source-byte results
- `docs/estate/attestations/R858_SINGLETON_BATCH_15.json`, commit `59846f3dbabb2159ffcc62030c11e334ce91777b` fetched again and cross-reconciled.
- Sorted original 685 singleton paths, indices **64–79 inclusive**, spanning `workers/narrator-worker/src/handlers/narrator-tts.ts` to `workers/private-life-model-index-provider/README.md`.
- **16/16 exact-source files verified** with independently decoded base64 raw bytes, Git SHA-1 object hash, SHA-256 content hash, manifest SHA/length and returned GitHub SHA. **57,258 new unique bytes; zero mismatches.**
- Hash functions self-tested against SHA-256 `abc` and empty Git blob. The sha256 constants were deterministically generated from first 64 primes and validated against the known test vector; erroneous interim preflight self-tests were stopped before any writes or claims.

## Full-mirror attempt (separate): INFRASTRUCTURE BLOCKED
- `docs/estate/attestations/R857_FULL_MIRROR_INFRA_BLOCKER.md`, commit `f94a7ecef671cc036e9de9da456693ad4d24be40`, read back.
- Attempted to run a comprehensive detached Git-mirror clone, all fetched-object streaming SHA-1/SHA-256, `git fsck`, all-ref census, LFS pointer review and manifest-to-tree check on disposable RunPod CPU pod `i2sael6d7ktvgr` (displayed $0.08/hour, 2 vCPU, 8 GiB).
- Provider system log reported **container startup disk quota exceeded** twice; the container did not initialize. No source clone or object hash result from R857.
- Explicit stop and independent get-pod confirmed **EXITED**. **R857 verification 0 — not PASS and not FAIL.** No paid retry initiated.

## Cumulative exact-source byte audit across fifteen JSON proof reports

| Metric | Reconciled value |
|---|---:|
| Candidate tracked paths | 1,177 |
| Candidate distinct Git blobs | 831 |
| Paths represented by actually byte-hashed Git blobs | **572** |
| Distinct Git blobs actually byte-hashed | **226** |
| Unique raw source bytes independently verified | **1,208,745** |
| Tracked path-instance bytes represented (repeats counted) | **2,079,848** |
| Remaining tracked paths / distinct blobs | **605 / 605** |
| Remaining current-tree path-instance bytes | **3,057,207** |
| Hash/size/path contradictions across all fifteen reports | **0** |

The 15 reports were re-fetched and every recorded path/SHA/length compared with the source-pinned 1,177-path manifest. R845's initial single-file hash is included in the R847 batch and not counted twice.

## Next work (exact resume)
1. Resume **singleton index 80** of 685 using the frozen selection protocol: exclude original 65 high-risk blobs, group source manifest by blob SHA, retain singleton groups; priority `functions/`, `workers/`, `scripts/`, `web/`, `docs/`, `launch-proof/`, `marketplace/`, `_audit/`, `other`, lexical path within priority. Indices 0–79 complete.
2. Continue small source-pinned API batches of at most 16 file blobs per write and reconcile all receipts. Do not count Git metadata-only API tree as actual-byte verification.
3. Full Git clone/history/refs/unreachable/LFS provider data remains unverified due to R857 infrastructure failure; retry only when working infrastructure and spending approval are available. A separately obtained GitHub recursive tree returned nontruncated 1,177 entries; metadata is not full-content proof.
4. Review concurrent Jobs #325 native R854 report separately. Its 7/7 verified stages **reproduce** `privilegedBypassObserved=true`, `storageLevelFenceVerified=false` in synthetic emulator, meaning Jobs #252 P0 security blocker is **unresolved**. Protected streaming, positive signed owner consent, sole-writer privileged IAM, deletion and device release still need independent proofs.

**GENESIS PRODUCTION HOLD. No app code, IAM, private media, production deployments, merges, or consent authority modified.**
