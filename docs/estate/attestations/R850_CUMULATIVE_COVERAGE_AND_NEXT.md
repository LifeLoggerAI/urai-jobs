# R850 — forensic audit continuation and duplicate-group checkpoint

**Immutable Jobs source:** PR #320 `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`; Git source tree `3e74b4b0d6e10df15f9ccd747e9e936218b7fc25`. This is a documentation-only evidence submission to draft #324.

## New verified source evidence

`R850_DUPLICATE_BLOB_BATCH_07.json` was committed as `9589119d75bab16790d1e9e890c469084dbb39cf`. It covers duplicate-group indices **31–47 inclusive** in the stable candidate sequence of 81 groups. One representative actual blob was fetched as base64 from the pinned source commit for each distinct SHA-1 ID, decoded to raw bytes, then independently checked against computed Git blob SHA-1 and SHA-256, source API SHA, and exact manifest size.

- **17/17** distinct new blobs PASS; **0** mismatches/errors.
- **20,856** unique raw bytes rehashed.
- **74** tracked path instances represented, collectively **95,020** bytes when repetitions count.
- The identical Git SHA object is shared across the represented paths. This is verified Git object identity, **not** independent downloading of each duplicate path.

## Deduplicated cumulative verification — seven batch files reread

| Metric | Verified count |
|---|---:|
| Tracked file instances covered | **404 / 1,177** |
| Distinct Git blobs independently hashed | **113 / 831** |
| Unique raw blob bytes fetched/hash-verified | **572,694** |
| Path-instance bytes accounted for | **1,177,498** |
| Tracked paths not yet covered | **773** |
| Distinct blobs not independently rehashed | **718** |
| Failed attestations | **0** |
| Missing paths, hash mapping contradictions, SHA/length conflicts | **0** |

These totals are independently reconciled from all existing per-file records in `R846_PART_01.json`, `R846_PART_02.json`, `R846_PART_03.json`, `R847_HIGH_RISK_BATCH_04.json`, `R848_DUPLICATE_BLOB_BATCH_05.json`, `R849_DUPLICATE_BLOB_BATCH_06.json`, and `R850_DUPLICATE_BLOB_BATCH_07.json`. R845's 1,011-byte first sample was independently redone in R847, so it is not an additional unique path or byte count.

## Exact continuation order

Reproduce duplicate candidate set from R845 `docs/estate/MANIFEST.json`: exclude the original 65 high-risk SHA IDs, group remaining paths by identical Git SHA, retain groups with multiple file instances, sort by descending group size and SHA lexical ascending. There are 81 such groups. **Indices 0–47 are now checked. Next: 48–63 (16 groups), 64–79 (16 groups), then 80.** Exclude already verified blobs when counting cumulative coverage.

After duplicate groups, verify singleton blobs in source priority order, then conduct all-ref/history/unreachable Git object/LFS investigations separately. Path metadata and the currently pinned commit do not prove exhaustive historical byte coverage.

## Production/security boundaries

Jobs #252 still requires a storage-enforced revocation write fence and drain, and production IAM verification. Emulator-only reservation, negative four-emulator results and precise blob hashes do **not** certify owner-authorized private rendering, signed C6, protected Replay, actual deletion, physical devices, or release. **Production HOLD.** No application code, IAM, deployments, merges or paid compute changed.
