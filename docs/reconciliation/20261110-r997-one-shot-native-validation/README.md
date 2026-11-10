# ONE URAI Genesis — R997 One-Shot Native Validation Launcher

**Research / engineering review only. Production HOLD; no merge, deployment, provider spend, worker stop/restart, or authenticated service acceptance.**

## What was independently exercised

- Refreshed GitHub status: Jobs R996 PR #396 remains an unmerged draft, source Git blobs pinned. All nine workflows are failures. One `build` workflow job 129693153551 was rerun via GitHub Actions; attempt 2 also failed with no test steps, so CI remains unknown/unaccepted.
- Inspected three previously existing CPU workers and a separate Ramsey 36-vertex research pod. R954 logs continue to show `fatal: destination path ... already exists`; R955 continues to return exit 128 and its same clone-log SHA, without native integration acceptance. The Ramsey candidate self-declared red K4 = 29, blue K6 = 9; **NOT A SOLUTION** and not independently reverified within R997 (logs no longer available after pod exit). Do not call it a mathematical discovery.
- At the first snapshot four pods were running at $0.48/hour listed; subsequently the Ramsey pod exited and three remained at $0.40/hour. The billing window is account-wide, not a provider-job invoice. No pod was stopped or restarted by this workflow.
- R996 local checkout verifier passed 19/19 tests on preserved source.
- R997 new `scripts/r997-single-attempt-native-verify.sh` source wrapper uses the R996 fail-closed exact-SHA checkout helper, reserves a single-attempt receipt directory, bounds `pnpm urai-jobs:verify` to 300 seconds, records a SHA-256 digest of the full log, records exit status and source Git tree, and propagates failure to the caller.
- `tests/test-r997-native-verify.sh` executes **14/14** local cases against a purpose-built fake `pnpm`; completed three successive times, with logs in `evidence/`. It has not run the real Jobs native suite. The mock is only testing runner process semantics and safety.

## Important limitations

1. The R997 wrapper is an additive review candidate, **not wired into R954/R955 pod commands**. Existing pod command changes or restarts are intentionally out of scope.
2. A locally produced `PASSED` receipt proves only that the chosen `pnpm` process exited zero; it is **not protected CI, authentic cross-service runtime acceptance, or independent reviewer approval**. This is made explicit in `receipt.json`.
3. The wrapper invokes `pnpm` from the existing PATH. Production adoption requires pinned Node/pnpm binary provenance and dependency-hash verification, as well as independent protections against a compromised runner host.
4. The path/receipt checks are designed for a trusted local operator; users sharing a writable filesystem could race path verification. Do not promote this to a multitenant security boundary without OS isolation and stronger openat/dirfd controls.
5. A 300-second timeout includes termination grace; it does not guarantee child processes are absent if they break away from the process group. Native production runners should be container/PID-isolated.
6. The test local source has no real Studio/Jobs private user memory, and no authenticated Privacy–Studio–Jobs–Replay–revocation/deletion trace.
7. Before using for live diagnostic work, verify checkout target is a trusted fresh path, establish compute cost authority and job ownership, and make receipts durable outside ephemeral container disks.

## Repeat

```bash
bash scripts/r996-safe-pinned-git-checkout.sh # usage check only (requires three params)
bash tests/test-r997-native-verify.sh
```

## Lineage

- R995 Jobs draft PR #395; R996 draft PR #396.
- R994 105 provider research jobs and cost schema are distinct from product CI and native Jobs verification; do not merge those evidence classes.

**Verdict: R997 local one-shot launcher implemented and tested; real cross-service acceptance NOT RUN; ONE URAI Genesis release HOLD / NO-GO.**