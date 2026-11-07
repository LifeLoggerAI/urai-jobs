# R856 — Jobs singleton source-byte audit, exact reconciled checkpoint

**Frozen candidate:** Jobs PR #320 `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`; Git tree `3e74b4b0d6e10df15f9ccd747e9e936218b7fc25`. **Audit review lane:** draft Jobs PR #324; documentation only, not code promotion.

## Newly committed R856 actual-byte attestations

- `docs/estate/attestations/R856_SINGLETON_BATCH_13.json`, commit `6b166d3eafe28f62172d84ac83937f7f2f0d1533`: fixed singleton indexes **32–47**, **16/16 verified**, **91,937 distinct bytes**, zero mismatches. Begins `functions/src/jobs/sceneTruthReceipt.ts`, ends `workers/captured-reality-worker/index.js`.
- `docs/estate/attestations/R856_SINGLETON_BATCH_14.json`, commit `c99ae48f78bf495d0a7f3b02fafe1ecb8c79872c`: singleton indexes **48–63**, **16/16 verified**, **19,449 distinct bytes**, zero mismatches. Begins `workers/captured-reality-worker/package.json`, ends `workers/narrator-worker/src/handlers/narrator-tts.js`.
- Both fetched exact Git source-ref contents in base64; independently decoded raw bytes and calculated Git SHA-1 (with `blob <length>\\0` prefix) plus SHA-256; checked source GitHub SHA and manifest file sizes; validated SHA-256 `abc` and Git empty-blob known vectors.

## Fourteen-batch deduplicated independent reconciliation

| Coverage indicator | Count |
|---|---:|
| Total current-source tracked file paths | 1,177 |
| Total distinct Git blob IDs | 831 |
| **Verified tracked paths** | **556** |
| **Distinct Git objects independently hashed** | **210** |
| **Actual independent unique-blob byte count** | **1,151,487** |
| Bytes represented by verified paths including shared-blob duplicates | **2,022,590** |
| Remaining tracked paths / distinct unverified blobs | **621 / 621** |
| SHA/size/path contradictions or failed hashes in committed reports | **0** |

These totals were recomputed from all fourteen attestation JSON files in `docs/estate/attestations/`, matched against pinned R845 `MANIFEST.json` (source `ea8f0165...`), and deduplicated by immutable Git blob SHA and tracked path. The R845 one-file sample is included in R847; do not count twice.

## Exact next step

Resume **singleton index 64** in the stable 685-singleton list. Construct list from R845 `MANIFEST.json` by grouping all 1,177 tracked entries by Git blob SHA, retaining groups of one not among the original 65 high-risk cohort. Sort by `functions/`, `workers/`, `scripts/`, `web/`, `docs/`, `launch-proof/`, `marketplace/`, `_audit/`, then `other`, and lexically by full path within each bucket. Indices 0–63 are verified. Continue in <=16-file batches to fit connector tool limits, with hash failures explicitly reported and never silently counted as PASS.

## Independent parallel P0 evidence

The parallel Jobs PR #325 / R854 report identified a **still-reproducible privileged late-write Storage bypass** in synthetic Firebase emulator tests. Seven native verification stages reported PASS as evidence of reproducing the problem, **not** evidence that it is fixed. Jobs issue #252 remains P0 OPEN. This byte-audit worker did not run that native suite; maintain separate source pins.

## Release/certification boundaries

Current tracked-tree byte coverage remains partial, and all-history/ref/unreachable-object, external LFS/provider media, semantic review, IAM sole-writer enforcement, real revocation-active-upload drain, protected Replay, positive signed C6, device testing and authorization are separate unfinished gates. Do not turn a hash certificate into a runtime or release certificate.

**One UrAi Genesis production HOLD. No application code, IAM changes, deployment, merge, paid compute, private-media writes, or new consent authority.**
