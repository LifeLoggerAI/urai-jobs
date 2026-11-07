# R853 — first singleton source-byte batch and next-worker handoff

**Immutable Jobs application candidate:** `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`, source Git tree `3e74b4b0d6e10df15f9ccd747e9e936218b7fc25`. **Documentation-only branch:** Jobs draft PR #324. No application-code merge.

## New R853 verified evidence

- `docs/estate/attestations/R853_SINGLETON_BATCH_11.json`, commit `efffc31737c9ebd425916f0e1ae7f37a7f453069`, fetched again from GitHub.
- **16 / 16** newly checked unique-source blobs, **166,342 actual source bytes independently rehashed**, **zero** mismatches or fetch errors.
- Selection: the 685 distinct singleton paths remaining after the 65 original high-risk verified blobs and 81 duplicate-group Git objects; stable sorting by `functions/`, `workers/`, `scripts/`, `web/`, `docs/`, `launch-proof/`, `marketplace/`, `_audit/`, then other, with alphabetical paths within each group. The first 16 ordered entries were examined (from `functions/package-lock.json` through `functions/src/events/onJobTerminalEvent.ts`).
- Every file was fetched from the exact immutable candidate as base64, decoded into bytes, independently Git-object SHA-1 hashed using the `blob <length>\\0` prefix, SHA-256 hashed across raw content, and checked against GitHub's original blob SHA and R845 file size. Hash methods were independently tested against the known SHA-256 `abc` and empty Git-blob vectors.

## Cumulative, all 11 reports reconciled

| Scope | Source-pinned coverage |
|---|---:|
| Tracked paths | **508 / 1,177** |
| Distinct Git blobs independently hashed | **162 / 831** |
| Actual distinct blob bytes fetched and hashed | **932,731** |
| Tracked-path bytes represented including identical-object repeats | **1,803,834** |
| Remaining distinct paths / blobs | **669 / 669** |
| Conflicting SHA/size/path metadata or failed attestations | **0** |

The ten earlier reports `R846_PART_01/02/03`, `R847_HIGH_RISK_BATCH_04`, `R848_DUPLICATE_BLOB_BATCH_05`, `R849_DUPLICATE_BLOB_BATCH_06`, `R850_DUPLICATE_BLOB_BATCH_07`, `R851_DUPLICATE_BLOB_BATCH_08`, `R852_DUPLICATE_BLOB_BATCH_09/10` plus this batch were independently re-read, deduplicated, and compared to the complete R845 manifest. The prior R845 one-file first proof is already included in R847 and must not be added twice.

## Concurrent worker security update

Latest Jobs #252 comment records **R854 native verification 7/7 stages PASS** on a separate worker's draft Jobs #325 `16a7f49c089473fdc7fe6478039fedc6bda014a1`; this **reproduces a privileged Firebase Storage late-write bypass** (`privilegedBypassObserved=true`, `storageLevelFenceVerified=false`) and reports the pod shut down. This audit did not independently execute those native tests. This is confirmation of a remaining blocker, not release acceptance. Do not mix application source from Jobs #325 into this frozen PR #320 byte census without separately comparing exact trees.

## Next

1. Resume the original stable singleton ordering at index **16**, first file `functions/src/events/publishJobTerminalEvents.ts`, then progress through functions, workers, scripts, web, docs, launch-proof, marketplace, retained _audit, other.
2. Store every batch's exact path, blob SHA, actual computed Git SHA-1, SHA-256, byte count and failures. Recompute deduplicated coverage after each batch; do not silently reset indices.
3. Separately examine full Git history, branches/tags/unreachable objects, external LFS/provider payloads and semantic dependencies. Current-tree hash agreement is **not** all-history byte/semantic certification.
4. Preserve security #252 HOLD. Real Storage IAM sole-writer evidence, revocation-safe upload termination and physical generations, owner signed C6 consent, protected Replay, device acceptance and independent production authorization remain unverified.

**GENESIS PRODUCTION HOLD. No app code changes, IAM changes, cloud deployment, merges, private-media writes, or paid compute from this audit.**
