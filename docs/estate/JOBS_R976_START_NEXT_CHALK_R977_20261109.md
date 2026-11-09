# NEXT CHALK — ONE URAI GENESIS R977 EXECUTION DIRECTIVE

**Release:** PRODUCTION HOLD / NO-GO. This is an engineering continuation, not release authorization.

## Read first
1. `docs/estate/JOBS_R976_DOCUMENTATION_CONTINUITY_AND_NEXT_CHALK_HOLD_20261109.md`.
2. `docs/estate/JOBS_R976_MACHINE_CHECKPOINT_20261109.json`.
3. `docs/estate/JOBS_R975_FULL_ACCEPTANCE_EVIDENCE_AND_NEXT_CHALK_HOLD_20261109.md`.
4. `docs/estate/JOBS_R975_MACHINE_CHECKPOINT_20261109.json`.
5. `docs/estate/JOBS_R974_RULES_REPAIR_PRIVACY_OWN_CLAIMS_AND_CI_EXECUTION_RECONCILIATION_20261109.md`.
6. `docs/estate/JOBS_R972_FULL_SYSTEM_RECONCILIATION_RULES_CONSENT_JOBS_PRIVACY_HOLD_20261109.md`.
7. `docs/estate/JOBS_R971_FULL_ESTATE_MASTER_CROSSWALK_AND_RELEASE_HOLD_20261109.md`.

## Critical R976 correction
Jobs main is **not** the old `2bcdbcf...` head anymore. A documentation-only R975 report commit was created on main:
- main `de1ee2539021dbba75722b0a31ed99556c24bb0d`;
- tree `ad57cbda366a8e3d57ef3ba6c83a1537cfa64d64`;
- parent `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`;
- one file added, 205 lines, zero application/deployment changes;
- unsigned, branch API protected=false.

Preserve the commit; do not rewrite history. **Always explicitly set the forensic branch on documentation writes.**

## Exact current candidate identities
- Jobs #381 `a295fd834c1cc01710a36b04523b023de2283240`; Rules fix exists; R943 static 15/15 PASS, native test not run.
- Jobs #382 `abdc13016fd83fbb4a3d7589645c1310d2344be0`; donor longform test blob `9af97cd9b2bd7e2a8e5e66d805c90791da60a52c`.
- Jobs #383 `1e70418b86ad56c209aa06a5d2d7f6a7bc4e102c`; 77 root commands enrolled, 17-case longform test enrolled, exact-head execution missing.
- Privacy #257 `fbdc590376376b758be968f174d71709f326c61f`; own-claims helper wired; Life Movie remains hard-denied.
- Jobs #379 forensic docs and Labs #262/#304 heads move concurrently. Re-fetch before edits.
- Current sampled Actions failure jobs for #383/#257 show runner_id=0, no steps and no artifacts. Do not claim app tests failed; runner allocation root cause unknown.

## R977 work order
1. Refresh Jobs main, PRs #379/#381/#382/#383/#389/#390/#391; Privacy #257/#186; Labs #262/#304; Spatial relevant PRs; issues Jobs #252/#345/#376/#380 and Privacy #83. Verify PR bases and ancestry.
2. Obtain approved clean, network-capable, credential-free runner. Checkout immutable #383 SHA. Verify tree/blobs, toolchain, clean worktree, no production credentials.
3. Run and archive separately:
   - `node --test scripts/owner_authority_rules.static.test.mjs` (15 expected);
   - `node --test scripts/life-movies-idempotency-revocation-race-contract.mjs` (17 expected);
   - `pnpm urai-jobs:verify` (77 command segments);
   - `pnpm typecheck`;
   - `pnpm build`;
   - guarded `scripts/run-r879-unified-native-acceptance.sh` with disposable demo Auth/Firestore/Functions/Storage emulators only.
4. Native Rules: use actual Firebase ID tokens to verify protected owner/deletion fields cannot be added/changed/removed (403), safe profile edit allowed, Admin readback unchanged, trusted deletion writer still functional.
5. On exact Privacy #257, run frozen installs, R27 unit tests, typecheck/build and demo-only four-emulator denial path; keep own-claims guard and `allowed=false`. Do not activate Life Movie.
6. Isolate R939 invalid canonical-record trigger exceptions and ECONNRESET/socket noise; archive full raw logs. Historical R939 earlier source `6fecb46e...` reported 199/199 unit PASS and emulator command exit 0, but is not clean current #257 certification.
7. Investigate GitHub runner allocation and required checks without bypass, blind rerun or fabricated pass.
8. Obtain owner-approved read-only Firebase/GCP project/database/Rules release/deploy principal/IAM inventory. Source config indicates Admin has a guarded Rules-capable path; reviewed Spatial/B2B governed workflows are not Rules publishers. Actual live publisher remains unknown.
9. Prove Jobs #252 in nonproduction: stale/alternate privileged GCS writer 403 after revocation, active/resumable upload drain, exact-generation physical delete, final absence and durable downstream purge ACK.
10. Resolve #376 post-admission authority, #345 concurrent quota/index parity, protected CI/independent review, live image/identity/ingress/rollback and same-SHA owner consent→Studio→Jobs→protected Replay→revoke→suppression→purge/ACK.
11. Preserve original LifeLogger/LifeOS/UrAi history and all other workers' review branches. Update forensic Jobs #379, Labs #262/#304 and machine-readable cross-chat handoffs with exact immutable source/test receipts. Do not silently merge.
12. Device/accessibility/AAA visual, legal/store/billing/backups and explicit founder GO remain independent gates.

## Receipt standard
For each actual execution, record exact commit/tree/blob IDs, tool versions, clean status, commands, stdout/stderr, TAP counts, exit codes, log SHA-256 and provider resource identity where applicable. Source wiring is not execution; static tests are not native Rules; workflow failure without steps is not application failure; ACK is not physical purge.

**NO MERGE, DEPLOY, RULES/IAM MUTATION, CI BYPASS, POSITIVE C1/C6 GRANT, PRIVATE RENDER, DISPATCH, CUSTOMER MEDIA, PAID COMPUTE OR PRODUCTION GO.**
