# NEXT CHALK — ONE URAI GENESIS R976 EXECUTION DIRECTIVE

## Read first
1. `JOBS_R975_ACCEPTANCE_EVIDENCE_PRIVACY_R27_AND_FIREBASE_AUTHORITY_RECONCILIATION_20261109.md`
2. `JOBS_R975_MACHINE_CHECKPOINT_20261109.json`
3. `JOBS_R974_RULES_REPAIR_PRIVACY_OWN_CLAIMS_AND_CI_EXECUTION_RECONCILIATION_20261109.md`
4. `JOBS_R972_FULL_SYSTEM_RECONCILIATION_RULES_CONSENT_JOBS_PRIVACY_HOLD_20261109.md`
5. `JOBS_R971_FULL_ESTATE_MASTER_CROSSWALK_AND_RELEASE_HOLD_20261109.md`
6. R970 stack/Rules reports; R969 branch/CI/C1 audits; R968 three-lineage reports; R967 Privacy source provenance; R966/R965 ACK/purge reports.

## Important state corrections
- Jobs main remains `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`, tree `282bd75464cc23d9a6add6a1340c6ae7d3adfc9a`, branch API protected=false/required checks off. Preserve add/revert history.
- Jobs #381/#383 source repair for #380 exists. Rules blob `d30c3e8fbbfcbf25767501e351edcb18d6080c6d` protects `dataRightsDeletionRequestId`.
- R943 actual static Node source suite: 15/15 PASS, exact Git blobs, TAP SHA256 `a68a5b4e7709387bcaa8aa1d856824817efa4b53104bea91d29525664e13da9e`. This is static source only.
- #381 native authenticated Rules test is authored/pinned but body NOT RUN.
- #383 exact head `1e70418b86ad56c209aa06a5d2d7f6a7bc4e102c`, package blob `4804276332491e1e57a95a2a0cec7050df3a595c`, root script 77 commands and original longform 17-case test enrolled. Neither 17-case, root suite, typecheck/build nor R879 emulators have run on this head.
- #382 donor test blob `9af97cd9b2bd7e2a8e5e66d805c90791da60a52c`.
- Privacy #257 current head `fbdc590376376b758be968f174d71709f326c61f`; own-claims hardening added. Life Movie purpose remains unregistered, verifier `allowed=false`, no grant or assembler.
- Historical Privacy R939 exact source `6fecb46e...` reported 199/199 unit tests PASS (including R27 9/9), installs/lint/typechecks/build/static Rules/root preflight PASS, emulator command exit 0 with 13 Rules + 3 integration assertions. But invalid-record Functions trigger exceptions, unhandled trigger termination and ECONNRESET/socket noise need investigation; raw logs absent; one worktree entry uncaptured. This is earlier source, not current #257 own-claims delta, nor clean deploy certification.
- Sampled Jobs #383 and Privacy #257 Actions jobs have runner_id 0, blank runner, steps null/empty and no artifacts. App-level test execution is not evidenced; cause unknown.
- Admin has a reviewed manual guarded Firebase deploy path that can include Firestore Rules for urai-4dc1d; reviewed Spatial WIF path is Functions/Hosting only and reviewed B2B workflow does not publish Rules. Shared source target remains an authority conflict, not proof of multiple active publishers or deployed overwrite.
- Privacy main root .firebaserc not found; Privacy #186 guarded deploy is Functions-only (functions:privacy).
- Jobs #252/#345/#376/#380 and Privacy #83 remain open.

## R976 execution work order
1. Refresh all main refs, exact PR heads/bases, issues, Actions runs and artifacts: Jobs #378/#379/#381/#382/#383/#389/#390/#391; Privacy #257/#186/#83/#214/#232; Labs #261/#262/#304/#284; Spatial #1962/#1964; issues #252/#345/#376/#380.
2. Do not treat workflow conclusion failure as source-test failure where runner ID 0/steps empty. Diagnose runner allocation and logs. Do not blindly rerun.
3. Secure an approved, clean, network-capable, credential-free runner. Checkout exact immutable #383 head; verify commit/tree, clean worktree, all source pins and toolchain.
4. Run separate gates with raw evidence:
   - `node --test scripts/owner_authority_rules.static.test.mjs` (15 expected);
   - `node --test scripts/life-movies-idempotency-revocation-race-contract.mjs` (17 expected);
   - `pnpm urai-jobs:verify` (77 enrolled command segments);
   - `pnpm typecheck`;
   - `pnpm build`;
   - inspect and run guarded `scripts/run-r879-unified-native-acceptance.sh` with disposable demo-only emulators and no production credentials.
5. Run original authenticated owner Firestore Rules test under guarded Auth/Firestore emulator: client ID-token add/change/remove of protected fields denied 403, allowed displayName edit works, Admin readback unchanged, trusted service deletion write still works. Exact source identity required.
6. Confirm all 17 longform idempotency cases pass; investigate missing/wrong-owner/wrong-org plan, read-only replay and no-write guarantees. Do not mark old R940 13/14 defect closed without 17/17 receipt.
7. On exact Privacy #257 `fbdc590...`, run root and Functions frozen installs, R27 Vitest, root/Functions typechecks and Functions build; then approved demo four-emulator negative/denial integration with own-claims helper. Never enable positive grant or render.
8. Independently investigate R939 emulator trigger noise with each intentionally invalid fixture isolated; preserve clean logs and stable socket/process behavior.
9. Obtain owner-approved read-only Firebase inventory: real project number, default database identity, deployed Rules release/etag, publisher principals and deployment history; confirm Privacy actual project/region. No deploy during discovery.
10. Assign one accountable publisher or approved database split. Do not deploy Rules until ownership/project/rollback accepted.
11. Prove Jobs #252 in authorized nonproduction GCS/Storage: stale and alternate privileged writers 403 after revoke, in-flight/resumable upload drain, generation-pinned deletion, final absence and durable downstream physical-purge ACK.
12. Resolve #376 continuation policy, #345 concurrency/index parity, deployed identity/revision/IAM, protected CI, independent reviewer, rollback, same-SHA owner consent→render→Replay→revoke→provider suppression→purge/ACK and all device/accessibility/visual/legal/operational gates.

## Receipt standard
For every run capture exact 40-char commit, tree, blobs, tool versions, clean status, exact commands, stdout/stderr, TAP count, exit code and SHA-256. A workflow badge is not an execution receipt. Enrollment is not execution. Source is not deployment. Jobs ACK is not physical purge.

## Boundaries
No merge, deployment, Rules/IAM change, CI bypass, C1/C6 enablement, positive Life Movie grant, private render, revocation dispatch, private media, paid compute or Production GO.

**ONE URAI GENESIS — PRODUCTION HOLD / NO-GO.**
