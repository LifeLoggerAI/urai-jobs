# NEXT CHALK — ONE URAI GENESIS R973 EXECUTION DIRECTIVE

**Read first:**
1. `JOBS_R972_SOURCE_AUTHORITY_VERIFICATION_NEXT_CHALK_HOLD_20261109.md`
2. `JOBS_R972_MACHINE_CHECKPOINT_20261109.json`
3. `JOBS_R971_FIREBASE_RULES_AUTHORITY_AND_OWNER_FIELD_RECONCILIATION_HOLD_20261109.md`
4. `JOBS_R970_19_REPO_FIREBASE_RULES_AND_CI_RECONCILIATION_HOLD_20261109.md`
5. R969 full-stack branch/CI/governance and current-lineage/C1 Rules reports.
6. R968 consolidated lineages, R967 Privacy harness provenance, and R966/R965 revocation ACK/purge reports.

## R972 evidence to preserve

- Spatial, Admin and B2Bportal current main source configs all map to `urai-4dc1d/(default)` and each configure a different Firestore Rules file. This is source-level competing publisher authority, not proof of deployed overwrite or breach.
- Exact blobs: Spatial .firebaserc `0d4fc68...`, firebase.json `2466dd32...`, Rules `26330636...`; Admin .firebaserc `48b58a1...`, firebase.json `9cdb6bfa...`, Rules `1b992631...`; B2Bportal .firebaserc `ea4ae234...`, firebase.json `f93da458...`, Rules `b17ec9f4...`.
- Privacy main has no root .firebaserc in the inspected ref. Privacy #186 guarded deployment is `functions:privacy` only and does not publish its changed Rules. Do not guess project ID or create deployment config.
- Jobs #380 remains open. Current Jobs main Rules blob `7dc63626...`; R940 review Rules blob `cfa77a8...`; both omit `dataRightsDeletionRequestId` from protected user self-update fields. Jobs #378 has seven test/script/docs files; no firestore.rules diff. It is not a Rules fix.
- Jobs #252/#345/#376/#380 and Privacy #83 remain open.
- Actions results sampled show failure but steps/logs are null or BlobNotFound; application test result is UNKNOWN, not pass or fail.
- Jobs main is `2bcdbcf34da4a3fe58619286d6917e2d4fa624e1`, tree `282bd75464cc23d9a6add6a1340c6ae7d3adfc9a`; branch protection metadata says disabled. Re-fetch before actions.

## R973 work order

1. Refresh all main/PR/issue/CI refs before changing anything.
2. Obtain owner-authorized read-only provider inventory for `urai-4dc1d`: project number, default database identity, actual deployed Firestore Rules release/etag, deployment principals, Firebase CLI/deployment history. No provider credentials are available through this source audit; do not pretend GitHub reads are provider reads.
3. Establish one accountable Rules publisher for shared database or an approved project/database split. Document owner, exact sources, deployment principal and rollback. No deployment in discovery.
4. Verify Privacy's actual project/region and keep #186 Functions-only. Do not add Rules deploy scope until owner explicitly approves.
5. Create a separate isolated Jobs #380 Rules source fix. Include `dataRightsDeletionRequestId` and the full owner/server field matrix. Add authenticated Rules-emulator tests proving add/change/remove denied for each protected field and ordinary safe owner edits still pass.
6. Run Labs #261 source detector and its eight Node tests on its exact immutable head; classify as source-only, never provider attestation.
7. Diagnose CI runner/log availability and obtain executable step evidence. No blind reruns or weakening gates.
8. Preserve R647, Jobs #371 and Privacy R818/R836 as separate integration paths.
9. Prove P0 GCS stale/alternate writer 403 after revocation, in-flight/resumable upload drain, exact-generation physical deletion, final absence and durable downstream ACK.
10. Complete #376, #345, deployed identity/revision/IAM, protected Replay, rollback, accessibility/devices/visual QA and founder GO.

## Safety and evidence boundaries

No merge, deploy, Rules/IAM mutation, CI bypass, C1/C6 enablement, revocation dispatch, private media, paid compute or Production GO. Unknown is not absent. Source config is not deployed state. Test enrollment is not test execution. Jobs ACK is not provider physical purge.

**Release remains PRODUCTION HOLD / NO-GO until independently verified.**
