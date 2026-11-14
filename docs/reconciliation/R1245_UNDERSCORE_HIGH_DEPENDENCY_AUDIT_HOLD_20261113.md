# CHALK R1245 — scoped production dependency high-advisory reduction (review only)

**Exact source basis:** merged Jobs #503 review commit `ed0a6b145e750ce872afbda80f965f522e70d0b1`. New review head `a44a8b9f7b5c98e264deea1d99d0e152f7371fdb`. Only `package.json` and frozen `pnpm-lock.yaml` change. Git blob SHA checks: `package.json` `cfdc05e2caa2b77922cf09494c4de2146e22679c`; `pnpm-lock.yaml` `14846b6f72d15c909bd0b97314dcb7a69094198a`. Authenticated GitHub source and independently cloned Runpod Git files match **2/2**.

**Change:** scoped pnpm transitive override `underscore@1.13.7 -> 1.13.8`; single transitive dependency occurrence under `jsdoc` changes and retains original importers/workspace. No application code, IAM, consent, storage write, Firebase Rules, or production deployment changes.

**Fresh original acceptance on existing R950 worker** `bvandlyauxhevl` in isolated `/tmp/urai-r1245/jobs`, Node 22.23.0 / pnpm 8.15.9:
- Frozen install `pnpm install --frozen-lockfile` **exit 0**, SHA256 log `49723b5a5309eb6e6b5095febc47b38cc00c42725a8983fbbb48e42a30350b1b`.
- Jobs Functions `pnpm --filter urai-jobs-functions build` **exit 0**, log SHA256 `41cd90ea02f5cdc63285990ff354663ab31ae75e623031040a31c034edf502e0`.
- Original security suites `node --test scripts/review-only/r1088-writer-separation-canary.test.mjs scripts/review-only/r1122-gcs-session-cancel-canary.test.mjs` **24/24 PASS**, process exit 0, TAP SHA256 `c3228fd88874846576f7e0b0f39b66acf79190efa381b67740c18c9f1343b0c7`.
- Original production audit `pnpm audit --prod --json` still **exit 1**, but high advisories reduce **15 -> 14**; critical **0**, moderate **30**, low **8**. Audit JSON SHA256 `80f288ab6ec401260f4bf607e728d506ae425201910e96fb02104c3c384a88df`.
- The reported `underscore` high advisory no longer appears; thirteen other advisory records carry fourteen high findings. Historical `lodash` high remains. A trial update using `lodash@4.18.0` was explicitly **discarded** because npm marks that version a BAD release; no lodash change is included.

**Limitations:** this is narrow dependency remediation only; *not* a clean audit, independent security approval, protected GitHub CI, complete Jobs test suite, cross-repo lifecycle signoff, live IAM or release GO. Preserve exact original evidence on R950 and the GitHub handoff. Next verify reviewer suitability, clear remaining 14 high advisories with separate safe resolution and test, restore protected CI. **HOLD_NO_GO; all eleven release gates BLOCKED; private memory writes DISABLED.**