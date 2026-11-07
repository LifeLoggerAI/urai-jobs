# R846 — continuing exact-source byte audit (Jobs #320)

**Origin:** R845 1,177-file/831-blob tracked-tree metadata baseline, candidate `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`; estate PR #324 (documentation-only).

## Independently rehashed
- R846 01: 18 files, 90,177 bytes. `docs/estate/attestations/R846_PART_01.json`
- R846 02: 16 files, 160,944 bytes. `docs/estate/attestations/R846_PART_02.json`
- R846 03: 16 files, 110,346 bytes. `docs/estate/attestations/R846_PART_03.json`
- Total new R846 coverage: **50/50 file instances**, **361,467 raw bytes**, 0 errors, 0 duplicate paths across these batches.
- Including independent R845 original 1,011-byte safety interlock: **51/1,177 tracked file instances**, **362,478 bytes**; 1126 file instances not yet independently byte-hashed. No assertion of completeness across all distinct blobs or Git history.

## Method and custody
Each report records exact path, pinned Git SHA-1 object ID, independently recomputed Git blob SHA-1, content SHA-256 and byte count. GitHub connector fetched content at exact application source ref as base64, raw bytes decoded, hashes recalculated inside this audit. Independently checked both known digest vectors. Verified reports were read back from GitHub before this aggregate was issued.

## Explicit remaining work
Next prioritize high-risk list indices **50–64** of 65 (manifest order; source-rights, write reservations, revocation, original 4-emulator runners, worker and Storage Rules). Then enumerate and rehash remaining 1,126 tracked file instances. Full Git history/all refs, unreachable objects, LFS/external assets, actual production IAM, real signed C6 and owner-only Replay still separate and open.

**Security:** Jobs #252 P0 open. Do not enable private render, consent issuer, bypass any Storage-write authority guard, or approve a release. **PRODUCTION HOLD.**
