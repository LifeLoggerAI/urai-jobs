# R860 — two further singleton source-byte batches, deduplicated reconciliation

**Immutable executable source:** Jobs PR #320 `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e` (tree `3e74b4b0d6e10df15f9ccd747e9e936218b7fc25`). **Audit-only lane:** Jobs draft PR #324, no application code or production permission modifications.

## New actual-byte verification

- `docs/estate/attestations/R860_SINGLETON_BATCH_17.json`, commit `fabd9942a228db68fe6f7ef47c8a30581f9c836f`: original singleton cohort positions **80–95**, **16/16 PASS**, **63,609 unique bytes**, no failures.
- `docs/estate/attestations/R860_SINGLETON_BATCH_18.json`, commit `cf535d92edac961891fa1db5143711f1fe52863e`: original singleton positions **96–111**, **16/16 PASS**, **117,631 unique bytes**, no failures.
- Both use exact-source GitHub contents as base64, independently decode raw bytes, rehash Git SHA-1 object header plus content and SHA-256 over raw bytes, and compare original R845 manifest SHA/size and returned GitHub SHA. Standard hash self-tests passed.

## Seventeen-file-report cross-reconciliation

Fetched all **17** existing committed attestation JSONs and the frozen R845 `MANIFEST.json` again. Deduplicated all file names and Git blob IDs; validated every covered path exists in the source manifest with matching SHA and file size.

| Metric | Verified |
|---|---:|
| Tracked files in frozen source tree | 1,177 |
| Unique Git blobs in source | 831 |
| **Tracked file instances covered** | **604** |
| **Distinct Git blobs independently rehashed** | **258** |
| **Actual unique content bytes fetched and rehashed** | **1,389,985** |
| Tracked path-instance bytes represented including shared blobs | **2,261,088** |
| Distinct current-source blob paths not yet byte-verified | **573** |
| Conflicting SHA, size, path mapping or failed hash records | **0** |

Prior sample R845 was independently reverified in R847 and must never be counted twice. Duplicate-path coverage in the original 81 groups shares the same exact verified Git blob object; it is not a separate download of each duplicate path.

## R859 historical/reference census: metadata only

- Paginated exact Git refs API pages 1–8: **695 visible refs**, including 303 heads, 388 pull refs, four tags, 416 unique tip SHAs. Full names/tips in `R859_VISIBLE_GITHUB_REFS.json`; summary in `R859_REF_CENSUS_AND_TREE_RECONCILIATION.md`.
- Nontruncated exact source Git tree 1,177 blobs + 216 directories was independently compared to R845 path/mode/SHA/size: zero discrepancies. This validates metadata, not the remaining raw blob bytes.
- The attempted R857 full-mirror all-object runner failed **before container startup**, with OCI `disk quota exceeded`. RunPod pod `i2sael6d7ktvgr` confirmed EXITED. Zero full-history object verification resulted; no further paid compute initiated. See `R857_FULL_MIRROR_INFRA_BLOCKER.md`.

## Exact next execution and release boundary

Resume original fixed 685-singleton cohort at **index 112**, then continue in source-pinned batches of at most 16 and reconcile actual bytes (573 unique blobs remain). Prioritization: functions/, workers/, scripts/, web/, docs/, launch-proof/, marketplace/, _audit/, other, lexical path within bucket. Do not silently claim current-tree completeness until all remaining hashes are verified. Independently inspect full Git reachable object graph / deleted/unreachable refs, LFS and external provider assets in a capable authorized environment.

Jobs **#252 P0 Storage post-revocation write fence** remains OPEN. Parallel R854 native 7/7 reported stages reproduce `privilegedBypassObserved=true`, `storageLevelFenceVerified=false`—not a fix or approval. Signed positive consent, producer sole-writer IAM, protected Replay, deletion, real-device acceptance and production authorization remain unproven.

**ONE URAI GENESIS PRODUCTION HOLD. No application code, IAM, merges, deployments, protected media or consent writes altered.**
