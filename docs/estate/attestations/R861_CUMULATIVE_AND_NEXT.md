# R861 — Jobs frozen-source singleton continuation (batches 19–20)

Immutable original source: `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`; original source tree: `3e74b4b0d6e10df15f9ccd747e9e936218b7fc25`. Audit-only draft Jobs PR #324; no changes to application code, deployment, permissions, or releases.

## Source-byte results

- R861_SINGLETON_BATCH_19.json: original deterministic singleton cohort indices **112–127**, **16/16 verified**, **108,397** distinct raw bytes, **0** mismatches; previously committed and independently fetched again this continuation.
- R861_SINGLETON_BATCH_20.json: indices **128–143**, **16/16 verified**, **126,943** distinct raw bytes, **0** mismatches; new commit `f6ab1090b70405b692440e9ebfe27d06f467d7d7`.
- Both JSONs were fetched from the audit branch before writing this summary. Each record includes path, original Git blob SHA, independently calculated Git-object SHA-1, raw-content SHA-256, byte length and result. Against R845 manifest and original source commit; 32 unique singleton blobs and **235,340** distinct raw bytes in these two batches.

## Reconciliation with R860

R860 recorded 604 unique tracked path instances, 258 unique blobs and 1,389,985 independently rehashed unique source bytes. These batches cover *new* positions in the fixed singleton ordering, with no overlap with prior cohort ranges. Adding verified rows produces:

| Metric | R861 checkpoint |
|---|---:|
| Frozen-source tracked paths | 1,177 |
| Verified tracked path instances | **636** |
| Distinct verified Git blobs | **290 / 831** |
| Independently rehashed distinct content bytes | **1,625,325** |
| Distinct blobs without an actual-byte certificate | **541** |
| Newly reported SHA/size errors | **0** |

These are source-tree byte checks, **not** exhaustive historical Git-object coverage, independent native/emulator runtime proof, actual signed-consent acceptance, deployed identity/IAM proof, protected private Replay authorization, or device acceptance. The R857 full-mirror runner previously failed on disk quota before startup, so historical/unreachable objects are not certified.

## Next / release boundary

Continue fixed singleton cohort at index **144** (batch 21); maintain 16-at-a-time exact SHA/source pinning and reconcile actual byte reports before claiming completion. Independently inspect remaining duplicates/cohorts and historical/external assets. P0 Jobs #252 remains OPEN: durable storage-enforced post-revocation future-write denial and active-upload drain are unproved. R854 observed privileged bypass; it is not a security pass. Preserve signed consent, owner-only private Replay, deletion and physical-device acceptance gates.

**ONE URAI GENESIS PRODUCTION HOLD.** No merge, live deployment, production permissions or private user media changed.
