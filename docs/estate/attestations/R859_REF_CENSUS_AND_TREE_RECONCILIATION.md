# R859 — paginated Git-ref census and frozen tracked-tree cross-check

**Frozen application source:** Jobs PR #320 `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`, Git tree `3e74b4b0d6e10df15f9ccd747e9e936218b7fc25`. **Audit-only PR:** #324.

## Current-source tracked tree: independent metadata comparison PASS
GitHub Git tree API `/git/trees/3e74b4b0d6e10df15f9ccd747e9e936218b7fc25?recursive=1` returned `truncated=false`, **1,393 entries = 1,177 blobs + 216 directory tree entries**. Every blob's path, SHA, mode and byte count was compared against pinned R845 `docs/estate/MANIFEST.json`; **0 mismatches**, 0 manifest extras, 0 tree blob extras. Total reported tracked-file bytes **5,137,055**. This independently corroborates *metadata only*, not the raw contents of unexamined blobs.

## Git visible refs: full paginated metadata evidence
- `docs/estate/attestations/R859_VISIBLE_GITHUB_REFS.json`, commit `d54bb3b39278b5f6316f744c259cfa9b0b4f5cde`, read back and parsed.
- Exact endpoint `/git/refs?per_page=100&page=N`, observed page lengths `[100,100,100,100,100,100,95,0]`. The zero-length page 8 closes the pagination sweep.
- **695 distinct ref names** (303 branch heads, 4 tags, 388 other refs); **416 distinct ref tip SHAs**. All listed name, type and tip SHA are preserved in JSON.
- A naïve unpaginated call returned only 30 refs; do not claim that default result is the full repository history.
- **Limitation:** ref tip metadata does *not* prove enumeration of all commits/trees/blobs reachable beneath those refs, deleted/hidden refs, server-unreachable objects, remote Git LFS payloads or external provider files. All-reachable-object raw-byte verification remains unperformed.

## Full Git mirror failure (R857, separate)
- R857 intended a disposable source-pinned full clone and streaming object verification. RunPod `i2sael6d7ktvgr` failed before container startup with OCI `disk quota exceeded`; zero object tests ran. Pod explicitly stopped and independently confirmed EXITED. Receipt at `docs/estate/attestations/R857_FULL_MIRROR_INFRA_BLOCKER.md`; no claim of PASS.
- No repeat paid compute provisioned following the failure.

## Tracked-tree actual-byte status (R858 last completed)
- **572/1,177** tracked paths represented by **226/831** independently rehashed unique blobs; **1,208,745** distinct content bytes, 0 mismatches. Current source untouched.
- **605 unverified current-tree paths and blobs** remain; next fixed singleton index **80**. API byte-level hash batches are still needed; the 695-ref metadata census does not increase byte-verified coverage.

## Parallel release blockers
Jobs issue #252 remains OPEN P0; independent native R854 Jobs #325 reported **7/7 test stages passing while reproducing** privileged post-revocation Storage write bypass in the synthetic environment. This is diagnostic failure of the security requirement, **not** release clearance. Signed positive consent, sole-writer IAM and active-upload drain, private Replay, deletion and physical-device evidence remain separate.

**GENESIS PRODUCTION HOLD. No app code, merges, IAM, deployments or consent grants changed.**
