# R849 — second duplicate-blob forensic batch, reconciled

**Exact source:** Jobs #320 `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`, tree `3e74b4b0d6e10df15f9ccd747e9e936218b7fc25`. **Evidence-only branch:** Jobs draft #324.

The R849 batch is `docs/estate/attestations/R849_DUPLICATE_BLOB_BATCH_06.json` (commit `3e756452deb29e05d7ff9ba163b168a36501b9ef`). It added **16 newly verified distinct Git blobs**, representing **126 tracked paths** from the retained original `_audit` trees, with **27,339 bytes of unique content** and **222,353 bytes counted with repeated path instances**. **16/16 SHA-1 Git object hashes and SHA-256 content digests matched**, zero errors.

## Deduplicated total, independently recomputed from all six committed proof files

| Metric | Count |
|---|---:|
| Tracked paths in source tree | 1,177 |
| Distinct blobs in source tree | 831 |
| Actual tracked paths represented by verified blobs | **330** |
| Distinct blobs independently rehashed | **96** |
| Unique blob bytes independently fetched/rehashed | **551,838** |
| Verified bytes with repeated tracked path occurrences | **1,082,478** |
| Path instances not covered | **847** |
| Distinct Git blobs not rehashed | **735** |
| Mismatches / failed attestations | **0 / 0** |

These figures are the **deduplicated union** of `R846_PART_01/02/03.json`, `R847_HIGH_RISK_BATCH_04.json`, `R848_DUPLICATE_BLOB_BATCH_05.json`, and `R849_DUPLICATE_BLOB_BATCH_06.json`. R845's first verified file is included within the R847 set and not counted again. Checked each path's pinned blob SHA against the matching attestation; no stray paths or missing mapping.

## Exact selection protocol and next worker

The original R845 source-tree manifest defines 1,177 paths and 831 blob IDs. Exclude the 65 verified high-risk blobs. Group remaining paths by identical Git blob SHA, select groups occurring more than once, sort by descending group size then Git SHA lexical ascending. There are **81 such remaining-candidate duplicate groups in total**. Batch 05 attested groups 0–14; batch 06 attested groups 15–30. **Next: groups 31–46**, followed by 47–62, 63–78 and 79–80, always subtract all previously verified blob IDs and record represented paths. Then the singleton blobs. Do not count additional repeated paths as additional independently fetched content bytes.

## Qualification / release safeguards

This certifies the integrity of exact current-tree Git blobs for the covered paths only. It does not certify all historical commits/refs/unreachable objects, remote LFS objects, external provider assets, secret material, code semantics, or secure production operation. Jobs security issue #252 remains **P0 open**: an old Storage writer must not create new private media after owner consent revocation. Emulator-only reservation simulations and client Storage Rules cannot substitute for effective sole-writer privileged IAM and durable transfer drainage. Signed positive consent, protected owner-only Replay, actual deletion, devices, and production authorization remain separate release gates.

**No application source, IAM, deployment, merge, billing or release status changes. Production HOLD.**
