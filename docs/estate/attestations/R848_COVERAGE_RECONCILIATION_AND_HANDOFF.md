# R848 — Jobs tracked-tree byte verification: duplicate-blob preservation

**Candidate:** Jobs #320 `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`. **Evidence:** Jobs draft PR #324, documentation-only.

## Checkpoint: independently reconciled
- Exact candidate Git tree still contains **1,177 tracked file instances** referencing **831 distinct Git blob IDs**; baseline Git-reported path-instance bytes **5,137,055**.
- R846–R847 high-risk set: **65 unique paths, 65 unique Git blobs, 482,744 raw bytes verified**.
- R848 duplicate historical snapshot batch: **15 additional distinct Git blobs**, **41,755 unique blob bytes actually fetched/rehashed**, corresponding to **139 file instances / 377,381 per-instance reported bytes**. All 15 blobs independently decoded at the exact candidate commit, SHA-1 Git-object rehashed, SHA-256 computed, and matched length/manifest SHA. Duplicate paths were **not individually refetched**: the same immutable Git object ID corresponds to their manifest entries.
- **Deduplicated union = 204 / 1,177 tracked path instances, 80 / 831 unique Git blobs; 524,499 distinct-blob bytes actually fetched and independently hashed; 860,125 path-instance bytes accounted for (repetitions included).**
- **973 tracked file instances / 751 distinct blobs remain.** No path/blob overlap between R847 and R848 cohorts, and no mismatches.
- R845 1,011-byte first sample was independently reverified within the 65 high-risk files; **do not add its byte count or path twice**.

## Evidence files
- `docs/estate/attestations/R846_PART_01.json`
- `docs/estate/attestations/R846_PART_02.json`
- `docs/estate/attestations/R846_PART_03.json`
- `docs/estate/attestations/R847_HIGH_RISK_BATCH_04.json`
- `docs/estate/attestations/R847_DEDUPLICATED_SECURITY_RECONCILIATION.md`
- `docs/estate/attestations/R848_DUPLICATE_BLOB_BATCH_05.json`

## Next audit sequence
1. Continue grouped **duplicate Git blobs not already covered**, in descending number of tracked paths then Git SHA lexical order. Exclude verified 80 blobs; retain every represented path and byte count. Do not count a rehashed blob as a new one.
2. Then hash distinct singleton source files, prioritizing `functions/`, `workers/`, `scripts/`, `web/`, `docs/`, `launch-proof/` and retained `_audit/` snapshots. Keep manifest source fixed, and preserve exact failure details.
3. Establish full refs/history/unreachable Git object inventory and audit external LFS/provider payloads only with source evidence. A recursive current tree is **not** a history or external-assets certification.
4. Reconcile parallel repository workers and the central master registry #262 before changing base or releasing.

## Security and release boundary
Jobs #252 post-revocation private-media Storage write fence remains open. The Firestore write-reservation model is emulator-only, private output writer denies real writes, and Storage client rules do not enforce broker-only privileged IAM. Neither this byte audit nor reported negative emulator acceptance certifies production owner consent, protected Replay, physical deletion/device acceptance, or release GO.

**Production HOLD. No application code changes, IAM modifications, billing, deployments, or merges.**
