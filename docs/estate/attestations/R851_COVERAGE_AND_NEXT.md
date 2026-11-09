# R851 — repeated-blob audit and exact continuation

**Pinned candidate:** Jobs #320 `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`, tree `3e74b4b0d6e10df15f9ccd747e9e936218b7fc25`. **Audit-only lane:** Jobs draft #324.

## Newly independently verified
- `docs/estate/attestations/R851_DUPLICATE_BLOB_BATCH_08.json`, source-pinned, commit `6c2870942698886cfa1e66a49fedb8fe76542684`.
- Original cohort of 81 duplicate groups (after excluding 65 high-risk blobs), ordered by occurrence descending then SHA lexically; indices **48–63 inclusive**.
- **16 / 16 new unique Git blobs verified**, **60,524 independent unique source bytes**, representing **50 path instances** and **183,413 bytes when path repetition counts**; zero mismatches.
- Each unique content object was fetched at exact source commit as base64, decoded into bytes, hashed as raw SHA-256 and Git `blob <length>\0` SHA-1; compared to source manifest paths, byte lengths, and GitHub SHA. Shared content paths were not independently redownloaded.

## Cumulative reconciliation across eight evidence batches

| Indicator | Coverage |
|---|---:|
| Tracked paths represented | **454 / 1,177** |
| Distinct Git blobs rehashed | **129 / 831** |
| Unique content bytes independently rehashed | **633,218** |
| Bytes represented across tracked path instances | **1,360,911** |
| Tracked paths still unverified | **723** |
| Distinct blobs still unverified | **702** |
| Reported hash, length or path conflicts | **0** |

The deduplicated union was recomputed from `R846_PART_01`, `R846_PART_02`, `R846_PART_03`, `R847_HIGH_RISK_BATCH_04`, `R848_DUPLICATE_BLOB_BATCH_05`, `R849_DUPLICATE_BLOB_BATCH_06`, `R850_DUPLICATE_BLOB_BATCH_07` and `R851_DUPLICATE_BLOB_BATCH_08`. The R845 original 1,011-byte interlock is present in the R847 high-risk batch and must not be counted twice.

## Next exact tasks
1. Complete duplicate groups **64–79** then final group **80**, using exactly the same source pin, ordering, raw bytes and proof fields.
2. Recompute coverage across all batch JSON records, deduplicate by immutable blob SHA and tracked path.
3. Then work on singleton files not already covered, prioritizing active source/test/scripts over historical snapshots.
4. Separately certify Git history, all refs, unreachable objects and LFS/external assets; a current-tree source audit is not an all-history audit.

## Release safeguards
Jobs #252 storage-enforced private-media revocation write fence still P0 open. No exact-byte receipt substitutes for positive signed consent, protected owner-only Replay, GCS IAM sole-writer authorization, real media deletion, physical-device acceptance, or production deployment approval.

**NO PRODUCTION GO. No runtime code, permissions, billing, merges, cloud resources or deployments changed.**
