# R857 — attempted full Git mirror and reachable-object audit: INFRASTRUCTURE BLOCKED

This is an evidence-only incident receipt, **not a completed hash audit**.

- Target: exact Jobs PR #320 commit `ea8f0165ac74511a4e4196919ddd3109d0c1ff2e`, expected Git tree `3e74b4b0d6e10df15f9ccd747e9e936218b7fc25`.
- Intended independent test: ephemeral public Git clone mirror; pinned source tree against existing R845 1,177-file manifest; streaming `git cat-file --batch` SHA-1 and SHA-256 for each fetched Git object; `git fsck` and local reachable-ref census; LFS pointer identification. Zero production access/credentials.
- RunPod transient CPU pod `i2sael6d7ktvgr`, image `ubuntu:24.04`, CPU `cpu3g` 2 vCPU / 8 GiB, hourly rate displayed $0.08.
- **Actual provider system logs**: repeated container initialization failures: `OCI runtime create failed ... unable to join session keyring: unable to create session key: disk quota exceeded` at 2026-11-07 06:48:59 and 06:49:14 UTC.
- No `R857_HOST_BOOT` or user script output was observed; therefore no checkout, no raw-object hashing, no source verification, no history result.
- Pod explicitly stopped via RunPod API; independent stop result `status=EXITED`. No retry or new paid pod authorized from this audit.
- Runtime status: **INFRA_BLOCKED, zero completed R857 verification**. The earlier 14-file-batch cumulative R856 remains **556 paths, 210 blobs, 1,151,487 independently verified bytes, 621 unique unverified tracked source blobs**.
- Full historical objects, inaccessible server objects and external LFS remain **UNVERIFIED**.
- Follow-up route: continue GitHub exact-ref byte hash batches using connected API; separately pursue reproducible clone/full-object audit when reliable environment exists, preserving source/tree and manifest pins.

**Jobs issue #252 P0 remains OPEN; native R854 security review still reproduces privileged late-write bypass. Genesis production HOLD.** No application code, IAM, private media, production changes or merges.
