# ONE URAI Genesis — R999 Native Exit-Code Fidelity

**Review-only. Production HOLD / NO-GO. Do not merge, deploy, or treat mocked command tests as native Jobs acceptance.**

## Source and change
- Parent: R998 draft PR #399 (commit 067537703cb2a6e98e7f8672297999c10cc4fc09), itself child of R997 #398.
- R997 runner previously ended with `(( rc == 0 ))`, which returned 1 for any nonzero native exit, even when the JSON receipt retained the true native code.
- R999 runner ends with `exit "$rc"`. This preserves native exit 12, 43 and 127 in the shell process exit status while retaining source, tree, timing, status and log hashes.
- Launcher original Git blob: 8bf07e647a5ac521c60edae4b8c4b2d3ce2e69e7. New blob: a183c1cae4a34bb28ecf1a0c2b50e2f558e073a4.
- Test original Git blob: 82e53b4b9b5905f2531d02685584b202e78e0225. New blob: fd55f58bb7da615caeab671a4245e773f2c0beb6.
- SHA256 runner: 978f7fdbbd389e5e9daa76b9105f48f3c8982d44952574b42f08f04436c0bb8d.
- SHA256 regression test: bff825625f5e92c3cd3bd193dc3b7bd286a173513798e2cd6401d10b1b97650c.

## Tests and their limits
- Before fix, the regression using the original launcher failed as expected: `R999_TEST_FAIL: expected rc 12, got 1` (baseline exit 1).
- After fix, `bash tests/test-r997-native-verify.sh`: 15/15 PASS, four consecutive locally executed runs. All four test-log hashes are equal: 8ae22f8d48ac4177598e2d430c0058eb4a0beef06a14f61d042aa5dd13e9f110.
- Tests use a fake `pnpm` backed by a local file:// Git fixture, and exercise source reuse, receipt uniqueness, ignored and index-concealed artifacts, symlink/path guards, exit-code 12 and exit-code 43.
- R996 parent exact-SHA helper is unchanged; previous R996 regression suite 19/19 is historical, not rerun in this checkpoint.
- This is source-process integrity evidence, not protected CI, native integration, production readiness, or independent external certification.

## Fresh live custody snapshot
- Runpod full inventory returned 334 historical pods; 3 RUNNING: R954 `75udipo6j06l7o` ($0.16/hour); R955 `sr5f5s1vancs9o` ($0.16/hour); R950 `bvandlyauxhevl` ($0.08/hour). Total listed CPU rate $0.40/hour. Previously running extra Ramsey worker is now EXITED.
- Previously observed R954 duplicate clone path and R955 exit 128 are unresolved. No running pods were stopped, restarted, modified, or charged through a new run by R999.
- GitHub CI previously had empty step histories and startup failures; no new CI-green assertion.
- Do not stop old pods before confirming artifact custody; a Runpod stop wipes container disk.
- R998 #399 independently audits consistency of local receipts; R999 repairs exit status propagation. These solve distinct problems and are stacked, not replacements.

## Next execution
1. Independent PR review and source/hash verification; diagnose protected GitHub Actions runner startup before counting CI.
2. Preserve any R954/R955/R950 ephemeral artifacts externally. Confirm owners, cost authorization and clean worker transition; stop redundant loops only with safe custody.
3. Execute the real native Jobs suite on an explicitly pinned clean checkout with verified Node/pnpm/dependency provenance; preserve source tree, result logs, and immutable receipts. Do not use fake pnpm results to claim native acceptance.
4. Independently verify authenticated Privacy -> Studio -> Jobs -> protected Replay -> revocation/deletion -> downstream purge, real device/a11y/AAA visual gates, and release rollback.

**No merge; no production deployment; production HOLD / NO-GO.**
