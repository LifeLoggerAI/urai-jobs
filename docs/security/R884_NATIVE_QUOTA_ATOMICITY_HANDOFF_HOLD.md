# One UrAi Genesis R884 — exact-source Jobs native gate correction (HOLD)

Date: 2026-11-07. Parent: R883 draft PR #353 head `57ffad3045bb3e2c1fedeab6f02dbcc7d91c7f6e`. Review-only additive child. Production **HOLD**.

## Forensic findings
At R883, ten GitHub Actions workflow runs at the exact head all reported failure, with no job steps returned by GitHub and job log fetches returning 404 BlobNotFound; no evidence of a compiler/test assertion failure, but ZERO green CI certification. Local node 22.16 and Java 21 are present; pnpm and full GitHub checkout unavailable, and git clone fails due to DNS. Thus authenticated native Firebase was not run, and a source smoke cannot be substituted.

More critically, R883 `scripts/run-r879-unified-native-acceptance.sh` contained the twelve-case quota *source* stage but never invoked `scripts/run-r879-jobs-native-auth-acceptance.sh`, despite that latter script being present. Its apparent final acceptance marker therefore did not prove Jobs Auth/Functions or the 14-way live-emulator transaction race at all.

## Changes (new R884 child branch)
1. Native test `scripts/r879-jobs-current-authority.firebase-emulator.test.mjs` now requires exactly ten of 14 parallel distinct-key requests accepted and four `resource-exhausted` (not just <=10), 1:1 durable job/queue/audit/idempotency-binding creation, a ten-entry ordered owner quota ledger, no quota debit for authorized same-key replay and no writes on overflow. It also preserves existing stale-role, disabled, tenant-transfer, deletion and authority tests. Exact Git blob `89f9a65d3276d606975b7f5f5d285f6cb4906c18`.
2. Unified runner `scripts/run-r879-unified-native-acceptance.sh` now pins the changed native test SHA plus original native runner SHA `67bc0b80ccebac3ac0e397a7e791dfc8f000404e`; checks `# pass 12` in source quota log; and explicitly invokes the original full four-emulator native runner after physical-generation evidence with disposable-only project, separate `URAI_ACCEPTANCE_SHA`, a strict native success marker and hashed failure receipts. Exact Git blob `8fe276661f094be2e4831d42c8bbfb0bc28ebcaf`.

## Truthful evidence
GitHub connector readback confirmed the two updated Git blobs and their native invocation / quota assertions; no production mutations or CI reruns were requested. The R883 pure helper file at Git blob `9b7a53c41c56681dfdf4cebbc00de9a962adf5d2` and exact checked-in R883 tests at `52598f8ab1e84e40e6f3246ca65a8dca8df776c0` were reconstructed in the local workspace; local Node source-only quota behavior 10/10 PASS, while the two source-integration checks require missing full checkout. This is not a native Auth/Firestore/Functions run.

The native 14-way race may reveal Firestore retry exhaustion or authentication/configuration defects; if so, do not weaken the acceptance or call the source certified. The R883 migration pre-read, document contention, owner-document update side effects, index availability, and 60-second clock policy still need live/disposable-native testing. No GCS IAM 403, C6 signed consent, inflight writer drain, Studio protected render, production authorization or owner-only Replay is verified.

## Safe completion requirements
Obtain independently authorized *clean exact Git head* checkout, Node 22 / pnpm 8.15.9 / Java 21, no production credentials, then run the now-wired unified runner `URAI_R879_ACCEPTANCE_SCOPE=DISPOSABLE_FIREBASE_EMULATORS_ONLY URAI_JOBS_ACCEPTANCE_SHA=<reviewed-r884-commit> bash scripts/run-r879-unified-native-acceptance.sh --run-exact-review-only` on disposable Firebase emulators only. Inspect stage logs, ensure no source modifications, reproduce four-resource atomic quota effects, exact ten/four acceptance, stale role denial and revocation races. Do not approve by unverified source tests.

Jobs issues #345 (native quota), #337 (operator authority), #252 (storage-enforced revocation fence) remain OPEN. Parent branches untouched, zero paid compute, no deployment/merge. **GENESIS PRODUCTION HOLD**.
