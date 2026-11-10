# Jobs integration acceptance repair — 2026-11-09

Production HOLD. Continuation of PR #394 at ca645496ff5de3910e70505440ce525f523589de; preserve its Studio #202 donor and #393 enrollment. No runtime application, consent, IAM, Rules, grant, or rendering changes.

## Reproduced and repaired

1. R879 invoked the actual Studio/Zod producer test before its nested R854 frozen dependency installation. A pristine checkout failed with ERR_MODULE_NOT_FOUND for zod. Move the required ten-case stage after successful R854. Preserve all existing source pins, negative Storage markers, failure propagation, and required assertions. Add a source-pinned three-case Bash orchestration regression: clean sequencing, prerequisite failure, producer failure. These are simulated stage bodies, not Firebase acceptance.
2. Full `pnpm urai-jobs:verify` reached the creation/revocation transaction harness and failed three of its fourteen cases with `serverLifeMovieOwnerOrgId is not defined`. Production imports the helper; the extracted-function VM harness omitted it. Compile and inject the actual production helper, not a permissive stub. The fourteen-case harness then passes, including unchanged revocation/deletion denial expectations.

## Executed evidence

Runtime: Node 22.23.0, pnpm 8.15.9, Java 21 available; actual Zod from frozen workspace lockfile (3.25.76). Local environment, not hosted protected CI.

- Frozen install across thirteen workspaces: exit 0.
- Ordering regression: three failures against prior ordering, 3/3 PASS after repair.
- Original source-pin helper suite: 5/5 PASS.
- Actual Studio producer/Jobs Zod suite: 10/10 PASS.
- Full root `pnpm urai-jobs:verify`: first run exit 1 at harness drift, repaired rerun exit 0 (79 top-level shell segments; do not treat this as 79 independent test cases).
- Root `pnpm typecheck && pnpm build`: exit 0. Runtime sources did not change in this repair.
- Bash syntax and git diff whitespace validation: exit 0.

Full verification is a mixture of source checks, synthetic fixtures, VM harnesses and local builds. It is not the native R879 Firebase acceptance wrapper, real GCS IAM fencing, positive consent issuance, private Replay, or end-to-end release certification.

## Resume

Run source-pin preflight on the committed head, then the exact R879 wrapper from a clean full-history checkout with Node22/pnpm8.15.9 and disposable emulator scope. Keep evidence outside checkout. Preserve hard-off authority. Consult the separately retained estate checkpoint for source heads and remaining provider/device/governance work. Attach native failure or success accurately; do not inherit historical receipts.
