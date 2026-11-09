# R852 — duplicate-current-tree Git objects complete; singleton phase ready

**Jobs application source:** PR #320 `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`, exact tree `3e74b4b0d6e10df15f9ccd747e9e936218b7fc25`. Documentation-only draft #324.

## Completed R852 batch evidence

- `docs/estate/attestations/R852_DUPLICATE_BLOB_BATCH_09.json`, commit `c9b1c05a0faccf1129bf6f2b81dfbdc93182e1f4`: repeated-blob groups 64–79, **16 / 16 verified**, 132,867 unique bytes, 36 represented path instances (275,973 repeated-instance bytes), zero mismatches.
- `docs/estate/attestations/R852_DUPLICATE_BLOB_BATCH_10.json`, commit `1901d7c09ca2a7b38d2d29b7780cf39d3e95aad9`: final group 80, Git SHA `f602f5ca93dbcfbc969019cc8249ef111035162d`, **1 / 1 verified**, SHA-256 `21080d45e8f9c30b768e21d8c8854a115b084a035c785cbf15477593b73c1ce2`, 304 unique bytes representing 2 paths.

The full 81/81 duplicate-group selection (after excluding 65 original high-risk blob IDs) has now been covered in batch files 05–10. Paths referencing an identical Git object are represented via their SHA, not independently downloaded repeatedly.

## Ten-batch deduplicated total

The complete set of **ten JSON proof records** (`R846_PART_01/02/03`, `R847_HIGH_RISK_BATCH_04`, `R848_DUPLICATE_BLOB_BATCH_05`, `R849_DUPLICATE_BLOB_BATCH_06`, `R850_DUPLICATE_BLOB_BATCH_07`, `R851_DUPLICATE_BLOB_BATCH_08`, `R852_DUPLICATE_BLOB_BATCH_09/10`) was read back from GitHub and independently reconciled against R845 `MANIFEST.json` at its pinned blob ID.

| Measure | Verified |
|---|---:|
| Candidate tracked paths | 1,177 |
| Candidate distinct blobs | 831 |
| **Tracked paths covered by actual independently hashed Git object contents** | **492** |
| **Distinct Git blobs hashed** | **146** |
| **Unique bytes independently fetched and hashed** | **766,389** |
| Path-instance bytes represented including identical blob repeats | **1,637,492** |
| Remaining tracked paths | **685** |
| Remaining distinct blobs | **685** |
| Remaining Git-reported path bytes | **3,499,563** |
| Failed hashes, contradictory SHA mappings, or manifest paths absent | **0** |

The one original R845 sample is already in the R847 cohort; never add it twice. In this exact source tree, **all 685 remaining path instances have distinct blobs** after subtracting all currently verified objects, so each must be fetched and hashed independently to complete the tracked-tree byte coverage.

## Next audit and release sequence

1. Begin **singleton unique-blob verification**, prioritizing live `functions/`, `workers/`, `scripts/`, `web/`, then `docs/`, `launch-proof/`, `marketplace/`, and retained `_audit/` snapshots. Include other root files, locks and package metadata. Record SHA-1 over `blob <size>\0` + bytes and SHA-256 over raw bytes, with explicit failures.
2. Before adding reports, compare draft PR #324 head and exact PR #320 source commit; do not overwrite another worker. Commit only documentation on the same review branch.
3. Do **not** present a current tracked-tree 100% hash as all-history/all-byte certification. Full branch/tag/unreachable object inventory, remote LFS, git ignored/untracked data and external media require their own independent proofs.
4. Preserve and reconcile parallel worker execution evidence, cross-repository positive owner-consent/Storage/Replay/device gates, and master registry #262.

**Jobs P0 #252 remains OPEN. Real private-media writing, positive consent, owner-only delivery/Replay, physical deletion and release authorization remain unverified. Genesis production HOLD. No code, IAM, paid compute, deployment or merge.**
