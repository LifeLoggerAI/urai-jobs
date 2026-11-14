# CHALK R1271 — lodash 4.18.1 + Zod 4.6.7 zero-high audit candidate (review-only HOLD)

Parent Jobs #509 review merge: `d7a7152cc3e971bbbf75a9f4d812b0b178058bdf`. Changes: existing `lodash@4.18.0` pnpm override formerly pinned to vulnerable `4.17.23` now `4.18.1` (non-deprecated; `4.18.0` is a bad deprecated release), Functions Zod dependency `^3.23.8` -> `^4.6.7`, frozen pnpm lockfile, and three Zod record-schema signature replacements in two source files: `z.record(z.unknown())` -> `z.record(z.string(),z.unknown())`, `z.record(z.any())` -> `z.record(z.string(),z.any())`, `z.record(z.boolean())` -> `z.record(z.string(),z.boolean())`. Explicit record key semantics retained. Five source files only, plus this handoff. No private-storage write enablement, IAM or consent bypass.

**Source blobs from original R950 isolated candidate:** `package.json` `683bd5707591a7bacd1c9551da595c52b560bb3d`, `pnpm-lock.yaml` `eb83d0ed0ede7641fa745b69159f9bbcee300ec4`, `functions/package.json` `3f9e506c02f91a51430bc626a783955396019836`, `functions/src/jobs/createJob.ts` `fd2e35252d6119d49fc5ed72ff3dedf83322d844`, `functions/src/release/releaseSequencePlan.ts` `3cc53d1093d6fb145f7724cdb9a2721afbfad0b1`. All five authenticated GitHub writes exactly match local blobs.

**Risk/control:** The first Zod 4 trial appeared to build before the new dependency was installed, but frozen install of actual Zod **4.6.7** found three TypeScript TS2554 errors. These were corrected using explicit string key schema (not ignored). A second build on installed Zod 4 PASS. Do not count the stale preinstall build.

**Actual original R950 candidate execution** in `/tmp/urai-r1271/jobs`:
- Frozen pnpm@8.15.9 install exit 0; actual installed Zod 4.6.7 verified; corrected Functions build exit 0.
- `pnpm --filter urai-jobs-functions test` exit 0 including Zod producer contracts (original log SHA256 `1d4785bcd7aa06f58ce5546326a7b077996e2f4d3dd025a2132d7121bf6096d3`).
- GCS writer-separation and session-cancel canaries 24/24 PASS, exit 0 (TAP SHA256 `723c4bba4103ab2180df9ace1b26c649976ecd1f86bf17fde5774239a8ebce93`).
- Root full `pnpm urai-jobs:verify` **EXIT 0**, original full log SHA256 `08576df9c4d0194519c374cea4fc9b78e13a319267432e93655a5eb2f61d0d88`.
- Production `pnpm audit --prod --json` **EXIT 1** with **0 high / 0 critical, 23 moderate, 5 low**; JSON SHA256 `d463e783e95cc2e84730673255e9f7076ee5de825a41d8fe736277b1e59b5ff5`. Zero HIGH is a scoped reduction, **NOT** a clean dependency audit or external security gate approval.

**Required:** repeat all critical tests from the exact GitHub PR HEAD and then actual merged review HEAD; preserve SHA and logs. Re-run Studio→Jobs and Privacy→Jobs source locks at exact new Jobs SHA. Major-version Zod validation semantics require independent review and real signed-owner positive lifecycle, not just test green.

**Launch reality:** Vercel SSO Genesis project `prj_pt7oOQLnCFki8vJb4ph9XhIjiLwZ` remains `live=false`, only ERROR deployment and no authorized GitHub provider (`no_github_account_connected`, Git namespace 401). Protected GitHub CI runs still fail/startup_failure. Live GCS exclusive broker writer, stale-upload drain and physical generation deletion, credential incident closure, qualified independent security/privacy/accessibility approval, Spatial/device/store acceptance and founder GO pending.

**Production HOLD_NO_GO, eleven launch gates BLOCKED, private-memory writes DISABLED. No main merge, production data-plane changes or public deployment.**
