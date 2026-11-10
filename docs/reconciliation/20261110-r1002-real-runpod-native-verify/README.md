# ONE URAI Genesis — R1002 real Runpod Jobs native verification

**Evidence class: REAL LOCAL NATIVE TEST ON RUNPOD. NOT protected CI or authenticated cross-service production acceptance. Production HOLD / NO-GO.**

## Source and custody
- Parent engineering PR #402, head `f82bd26ae5b2363017fe649e62949e724f7295f4`; exact checked out Git tree `6625c205edb006f05d11cd39ea8bd2420729005f`.
- New R1002 CPU Runpod pod `69ucfbimi49j9b`, secure cloud US-MO-2, 2x cpu3g 8GB RAM, $0.08/hr listed while running, no persistent mounts, container `node:22-bookworm`.
- Actual toolchain Node `v22.23.4`, Corepack explicitly `enable` then pnpm `8.15.9`.
- Exact SHA Git fetch succeeded. Native entrypoint `scripts/r997-single-attempt-native-verify.sh` fetched from the exact commit and executed after review of Git tree.
- R1001 source helper permission defect repaired; Git checkout helper invoked via bash.
- Real `pnpm install --frozen-lockfile` completed; postinstall shared-types build completed. Real `pnpm urai-jobs:verify` completed.
- Console output `R1002_NATIVE_LAUNCHER_EXIT=0`, `R1000_NATIVE_STATUS=PASSED EXIT=0`.
- Receipt `R1000_NATIVE_VERIFY_V1`: `evidence_class=LOCAL_SCRIPT_EXECUTION_NOT_PROTECTED_CI`; status PASSED, exit_code 0, duration 57 seconds, UTC start `2026-11-10T19:10:16Z`, end `2026-11-10T19:11:13Z`.
- Receipt source_sha `f82bd26ae5b2363017fe649e62949e724f7295f4`, tree_sha `6625c205edb006f05d11cd39ea8bd2420729005f`.
- Receipt log hashes: native `5bcf327bb755d68f9e2847b7dc2bfe448810cbdb85b721af83fc58ca957040a3`; frozen install `266a21e025c5238fb887af97ed3cd3306fb97c0669673c660c6cc6d6124307a0`; toolchain `9ceb252f59c3bcc349b45dca9308a08f81211cd1f90e053a973acafd1a222f9a`; launcher log `7b215bd03bfa75125d07cb84943f9852a95e997c6b67429a414d76412616ada2`.
- Important collector issue: wrapper printed literal `R1002_WRAPPER_EXIT={PIPESTATUS[0]}` from a harmless shell string construction defect, **not an actual exit value**. The independent launcher output and JSON receipt both report exit 0; do not cite malformed wrapper field as evidence.
- Native log tail includes terminal R888 quota-ledger Node TAP summary `6 tests, 6 passed`. This final suite does not alone establish count for all commands in the large composite `urai-jobs:verify`.
- Logs were read via bounded Runpod stream; SHA-256 checksums identify on-pod /tmp files. Runpod has no persistent mounts on this pod. The full raw /tmp logs were not externally exported. This is a visibility/custody caveat for independent reproduction, not a reason to erase the observed pass.
- R1002 pod was explicitly stopped after receiving emitted receipt and independently confirmed EXITED. Ephemeral on-container disk has been wiped; no billed compute left from R1002. Pod-specific billing returned no finalized record yet, do not invent amount.

## Related estate state
- Runpod last complete inventory: only R950 `bvandlyauxhevl` RUNNING ($0.08/hour listed), container command `sleep infinity`; preserve ownership and any ephemeral work before deciding to stop.
- R954 `75udipo6j06l7o` and R955 `sr5f5s1vancs9o` EXITED. Runpod audit shows account actor `user_3JtD2VMHxHMrJeVr3AcGz4u0INJ` initiated stops at 2026-11-10T18:36:25Z / 18:36:27Z. This identifies account actor, **not human-versus-agent operator**. Their containers lacked persistent mounts; complete old /tmp artifacts unavailable.
- Account-wide billing at last query $9.372638310336697 over 23 returned hourly buckets (Nov 9 20:00Z–Nov 10 20:00Z), includes pods, endpoints, and storage; not benchmark-only.
- Existing GitHub #402 and predecessors are draft review PRs, unmerged. Protected GitHub Actions on #402 exact head reported nine failed workflows; cannot use this Runpod result to mark them green.

## What this proves and what it does NOT
- **Proves** source-pinned checkout + correct Node/pnpm + real frozen dependency installation + real `pnpm urai-jobs:verify` exit 0 in an isolated Runpod container on this exact commit, according to an internally consistent local receipt and console evidence.
- **Does NOT prove** protected or independently signed CI, authenticated Studio-to-Jobs native producer-consumer exercise with real services, Privacy->Studio->Jobs->protected Replay->revocation/deletion purge, real Firebase Storage writer-fence behavior, device/browser/a11y/AAA visuals, deploy/rollback authority, independent review, or release approval.
- The suite includes source-contract, mock, and local tests; the full outer production release gates remain separate.

## Next Chalk / Cheese / Council handoff
1. Treat PR #402 commit f82bd26ae5b2363017fe649e62949e724f7295f4 as the **tested source pin** for the R1002 Runpod pass. The R1002 documentation PR is evidence-only and does not claim new application source changes.
2. Obtain independent review of PR stack #395–#402; restore readable GitHub Actions runners/steps. Maintain protection; do not bypass approvals.
3. Reproduce real native verification in an approved isolated pod/CI with all receipt files exported to durable external storage *before stopping*. Require exact source, toolchain, lockfile, npm/pnpm and log hashes; **no duplicate retry loops**.
4. Move to authenticated cross-service Studio->Jobs execution and full Privacy->Replay deletion/purge acknowledgements, preserving private-user consent and evidence.
5. Reconcile R950 custody and ongoing $0.08/hr idle compute; do not stop without evidence preservation and worker-owner alignment.
6. Reconcile system-wide estate, device/visual/a11y checks, protected deploy/rollback and independent review; remain Production HOLD until proven.

**Verification recorded 2026-11-10 UTC. Never promote local native PASS into release green.**
