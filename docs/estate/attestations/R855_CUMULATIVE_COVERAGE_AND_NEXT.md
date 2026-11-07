# R855 — active Jobs singleton byte attestation and verified handoff

**Pinned executable source:** Jobs draft #320 `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`, tree `3e74b4b0d6e10df15f9ccd747e9e936218b7fc25`. **Documentation-only branch:** Jobs draft #324.

## Current independently verified receipt
- `docs/estate/attestations/R855_SINGLETON_BATCH_12.json`, Git commit `7ac3e17103b78391afde3767fb541a1f17879b29`.
- Exact singleton cohort positions **16–31**, selection from 685 unverified distinct blobs ordered `functions/`, `workers/`, `scripts/`, `web/`, `docs/`, `launch-proof/`, `marketplace/`, `_audit/`, `other`, then lexical full path.
- **16 / 16 files independently downloaded as base64 from the immutable source, decoded, SHA-1 Git blob (header+bytes) and raw SHA-256 rehashed, GitHub SHA and R845 manifest size verified. 107,370 unique bytes; 0 errors.**
- Source span begins at `functions/src/events/publishJobTerminalEvents.ts` and ends at `functions/src/jobs/retryExpiredLeases.ts`. SHA implementation verified using the known SHA-256 `abc` and Git empty-blob test vectors.

## Independently reconciled all twelve report JSON files

| Measure | Current evidence |
|---|---:|
| Current tracked paths | 1,177 |
| Distinct Git blobs in source | 831 |
| **Paths covered by verified blob bytes** | **524** |
| **Unique blobs independently verified** | **178** |
| **Actual unique content bytes verified** | **1,040,101** |
| Path-instance bytes represented including repeated Git objects | **1,911,204** |
| Remaining paths and unique blobs | **653 / 653** |
| Failed or conflicting records / manifest path-size-SHA mismatches | **0** |

All prior 11 reports plus R855 batch 12 were read back from GitHub and their path↔blob SHA↔size mapping compared against the immutable R845 `MANIFEST.json`. The original R845 safety-interlock sample is included in the R847 high-risk receipt and is not counted again.

## Reconciled parallel security work
Jobs issue #252 remains open P0. The parallel R854 worker's draft Jobs #325 `16a7f49c089473fdc7fe6478039fedc6bda014a1` reports native **7/7 stages PASS** while explicitly reproducing `privilegedBypassObserved=true` and `storageLevelFenceVerified=false`. This is a separate execution report, not independently rerun by this byte-audit worker, and **not** proof that post-revocation privileged media writes are blocked. Do not mix source pins.

## Next step
Resume **singleton offset 32** of the original fixed 685-order list; keep source commit and ordering unchanged. The next 11 unverified `functions/` files are followed by `workers/`, then `scripts/`, etc. Continue in small batches of <=16 to avoid connector tool-call limits. Reconcile all report JSON blobs after each commit, preserving exact failures and excluding existing 178 verified object IDs. After current tracked-tree 100% is independently hashed, audit complete Git history/refs, inaccessible/unreachable objects, Git LFS and external provider artifacts separately—do not conflate tree completeness with all historical bytes.

**Security #252 and Genesis release remain HOLD.** No application code, cloud IAM, deployments, billing, merges, protected media operations or new consent permissions were changed.
