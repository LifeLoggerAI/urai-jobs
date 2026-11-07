# R879 — Jobs original native callable authority acceptance (HOLD)

2026-11-07 UTC. Review-only test addition on the exact PR #344 source commit 655ec08da182515560342c561c914138e624d7b1. Parent reconciliation commit 5e8806dc623533ddc75bc9f51ff000421995d875 has ordered peer parents Jobs #336 (Storage) and #338 (current authority). No source logic was changed, no peer branch overwritten, no production or billable cloud operation authorized.

## Immutable added original files
- scripts/r879-jobs-current-authority.firebase-emulator.test.mjs: amended 13,574 source bytes, exact Git blob f7d8a7ba6ff0e99570b7e6c3b2e731ecafe9cdef. Supersedes the original 10,705-byte eight-case source, without touching production engine code.
- scripts/run-r879-jobs-native-auth-acceptance.sh: 5,017 source bytes, exact Git blob 67bc0b80ccebac3ac0e397a7e791dfc8f000404e; the runner preserves original four-emulator run authored in original blob a0860c014eeddd4e73ac691d057d61a98012b42f and adds a final native job authorization test.
- All real test media, accounts and calls are synthetic, isolated to demo-urai-jobs. Teardown recursively deletes each synthetic owner's jobs and logs, queues, and idempotency bindings, and fails if cleanup fails. The source checks that quota env settings are absent or exactly 10/min. The Auth emulator issues real local ID tokens. The script calls the original exported Functions over localhost and inspects original Firestore state. No mock auth decisions are used in this new native stage.

## Nine defined native test groups (UNEXECUTED)
1. Active owner creates and reads a real queued job, owner and tenant match.
2. Identical owner/key request deduplicates without additional job.
3. Foreign owner cannot read, cancel or create without permission.
4. Demoted/disabled operator holding an earlier operator custom-claim token cannot read, cancel, list jobs, read logs, or retry another owner's job from Gen1 or Gen2 callables.
5. Disabled owner cannot access job details or create/replay old key.
6. Central deletion-pending owner cannot access job or enqueue.
7. Tenant and organization transfer invalidates historical bound job; new scope and same-key retry behave correctly.
8. Removing current create permission rejects both old-key replay and new admission.
9. Separate synthetic quota owner submits 14 distinct requests concurrently. Assert at most 10 admitted (original 10/min limit), exact durable accepted-job count, and resource-exhausted denial for all blocked requests. This is an intentionally red-capable native regression for open P2 issue #345, not evidence of a successful fix.

## Original clean runner acceptance
Run only in a clean disposable checkout at the exact currently reviewed PR head, with Node 22, pnpm 8.15.9, Java 21, ffmpeg/ffprobe, Firebase CLI 15.24.0 and no live credentials. Command:

    git checkout --detach <exact-current-PR-head-SHA>
    test -z "$(git status --porcelain --untracked-files=all)"
    node --check scripts/r879-jobs-current-authority.firebase-emulator.test.mjs
    bash -n scripts/run-r879-jobs-native-auth-acceptance.sh
    URAI_ACCEPTANCE_SHA="$(git rev-parse HEAD)" bash scripts/run-r879-jobs-native-auth-acceptance.sh

The runner enforces exact reviewed SHA and clean source, rejects inherited cloud credentials and real project/bucket config, performs frozen install, shared/types and Functions build, full typecheck/build, original demo four-emulator acceptance and then R879 native test with explicit opt-in. Capture original source/tree hash, lockfile digest, runner versions, raw logs, exit codes, Firebase local HTTP responses and SHA-256 log digest before any PASS claim.

## Observed evidence and limitations
- Initial eight-group draft passed Node 22.16.0 syntax check, but the latest nine-group GitHub-published source with quota and strict teardown has NOT been rerun under Node or Firebase. Do not transfer the earlier syntax verdict to the amended exact source.
- This execution environment had Node v22.16.0, Java 21 and git; pnpm is absent, complete checkout unavailable and github.com / registry.npmjs.org DNS fails. Therefore NO original native Auth+Firestore+Functions run, full frozen build, full verify or new exact-head CI certification occurred in R879.
- Older exact-byte 25/25 R875–R877 local tests remain source-level (mocked/pure), not native Firebase receipts. Do not transfer those results or the older peer Storage 17/17 source tests to this new unexecuted HEAD.
- Jobs P1 #337 authorization must pass actual negative tests. Jobs P2 #345 concurrent quota admission now has a *defined source-level native test*, which has NOT executed. If it reveals quota overshoot, retain HOLD and fix on a reviewed branch before any GO.
- Jobs P0 #252 Storage future-write revocation and active-upload drain still OPEN: emulator Storage Rules cannot prove live privileged GCS old/alternate identity denial (real HTTP 403) or irreversible post-revocation no-late-byte ACK.
- No real signed positive C6, protected Studio MP4/SRT rendering/Replay, owner withdrawal/deletion physical pipeline, device acceptance, provider authorization, IAM grants, paid compute or production release is certified.

Verdict: original-source native acceptance harness PREPARED, NOT RUN. Review-only; Genesis production HOLD.
