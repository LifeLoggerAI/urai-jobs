# ONE URAI Genesis R1000 — frozen native-admission gate

**Draft review only. NO MERGE / NO DEPLOY / Production HOLD.**

Source parent: R999 PR #400, head 34f94a1189c61cc43acc83d01cd273dbc65304bf. R999 exact exit-code propagation remains intact. R1000 fixes the missing toolchain and dependency-install stage before `pnpm urai-jobs:verify`: checkout exact SHA, reserve a one-shot receipt, require Node 22 and pnpm 8.15.9, verify packageManager and urai-jobs:verify script plus pnpm-lock.yaml, run 180-second bounded frozen pnpm install, check tracked source and Git index flags after install, then launch 300-second bounded native command. Receipts now distinguish precheck failure (125), install failure (native exit), source mutation (126), native failure/success, and preserve separate SHA256 logs for install, toolchain and native execution. These checks are trusted-host preflight, NOT cryptographic toolchain authenticity or hostile multiuser filesystem isolation.

Runner SHA256: ff2d86e8909e31840d9395fa8967a5794e88387c1c87f04dcf52cebe3aa7e72e (Git blob 8e55ae28818f72956907a939fb7305507ebcc1eb).
Regression suite SHA256: 38a8a203d77f94270b7dd2782c1ea3a672022dfe3d721a6bb3a11654128e8a1c (Git blob 9c80ed66a8d64947da22a5e84238cf7b36e5cafa).
Four consecutive controlled local test runs: 18/18 PASS each; each test-log SHA256 172f71a75eb270d251d738305b6c51b1274bdef6502a55f0af6679feaa5ec36e. Negative cases: wrong pnpm version -> 125/precheck; failed frozen install -> exact 17/install failed, native command skipped; tracked-source tampering during install -> 126/source mutation, native skipped. Old 15 R999 checks retained including exact exits 12 and 43, dirty checkout, ignored files, index masking, and duplicate receipts. Test harness uses fake pnpm and local file:// Git fixture. **NOT real dependencies installed, Jobs native integration PASS, protected CI or authenticated service acceptance.**

Actual package.json at R999 defines `urai-jobs:verify`, packageManager `pnpm@8.15.9`; `.github/workflows/ci.yml` pins Node 22/pnpm 8.15.9 and frozen install. Actual Jobs native verification has many dependent commands and external gates; full run remains unverified. Local container cannot resolve github.com and lacks pnpm, so do not claim authentic Jobs test or cross-service acceptance.

GitHub R999 9/9 workflow runs reported failure; sampled jobs still had null/empty steps, not actionable passing CI. Runpod full inventory 334 historical pods, three RUNNING R954/R955/R950 combined listed $0.40/hr; billing query account-wide ~ $6.053752270470795 for returned 23 hourly buckets. No Runpod pod lifecycle action, provider inference, merge, or release in this checkpoint.

Next: independent review, restore protected CI with real job-step logs, verify Node/pnpm toolchain provenance and dependency provenance, execute real pinned native Jobs tests in authorized bounded ephemeral environment with durable custody, then authenticate Privacy -> Studio -> Jobs -> protected Replay -> downstream revocation/deletion and complete visual/device/a11y/rollback gates.

**Production: HOLD / NO-GO.**