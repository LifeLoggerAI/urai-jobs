# R883 — Native emulator acceptance teardown closes Jobs quota-lock footprint

**2026-11-07 UTC. REVIEW ONLY.** Child of Jobs [PR #356](https://github.com/LifeLoggerAI/urai-jobs/pull/356) at immutable head `0802ea7d6f23b05f20b0e13caf49086ecf77d3c7`. Source/runtime Jobs engine, Firebase Rules, IAM, production, private media and provider permissions untouched.

## Finding and exact modification

- Jobs R880 introduced `jobCreateRateLimitLocks/{SHA256(ownerUid)}`, but inherited R879 native Auth/Firestore/Functions test teardown deleted synthetic user jobs, queues, logs and idempotency bindings **without deleting quota-lock documents**. Repeated emulator runs could leave uniquely generated owner-derived records. This is a testing-environment cleanup defect, not an observed production privacy breach.
- The only native-test change is `scripts/r879-jobs-current-authority.firebase-emulator.test.mjs`: import Node `createHash` and delete the uniquely generated per-owner quota lock after job and binding cleanup but before removing the synthetic user. The hash domain separator is exactly `urai-jobs:create-rate-limit-lock:v1` followed by a single **newline byte** and the UID. An initial string-escape mistake in the draft was found and corrected before opening review; current source uses `String.fromCharCode(10)`, not literal backslash+n.
- The current standalone engine helper is unchanged at `functions/src/core/jobsReliability.ts` blob `c6b76553efd83f377b8ea8a5710f6f199a1ff9d9`. The amended native test is Git blob `2baad0d9c9609a88f8057049d5d3b3c4f7f9ba48`, 14,047 source bytes, and still defines the same nine pre-existing native test groups.
- Added `scripts/r883-native-emulator-lock-teardown.test.mjs` blob `15bd13f3847500ee7b0b5203a33bcd8e33b17964`, 2,196 bytes, with three cases: real helper versus Node SHA256 byte contract; native source cleanup ordering (recursive job/log, binding, lock, user); and fail-closed cleanup error reporting. Enrolled at the tail of the preserved root `urai-jobs:verify`, package Git blob `4022c5a054cd62d4dc497aae1e852cc04b88cad3`.

## Reconciliation evidence

- Direct GitHub readback of exact updated native test, R883 source-level test, unchanged Jobs helper and package. **11/11 independent read-only connector-side source assertions PASS**, including the nine case group count, current domain-separator newline, owner-scoped loop and lock deletion, recursive job/log and binding deletion, fail-closed cleanup, canonical helper matching, and verify registration.
- These 11 checks inspect source strings; **the three-case R883 Node test has not yet executed from a complete checkout** and the nine native R879 Firebase groups have not run. Do not promote source assertions to Firebase/Node PASS.
- Original full detached clean repository, pnpm 8.15.9, Firebase CLI, authenticated native emulator runtime and full workspace build are unavailable in current container (external GitHub DNS cannot resolve, pnpm not installed). No test artifacts of a genuine emulator run were claimed.
- The reviewed protected Jobs deletion code first sets a Firestore owner deletion fence transactionally before anonymizing jobs, then removes the owner-derived quota lock. Thus the previously suspected missing initial owner fence **is not a verified R883 defect**.

## Exact acceptance

On a clean disposable checkout of the precise R883 PR SHA, Node22/pnpm8.15.9/Java21 and original source only:

```bash
git checkout --detach <reviewed-R883-HEAD-SHA>
test -z "$(git status --porcelain --untracked-files=all)"
pnpm install --frozen-lockfile
node --experimental-strip-types --test scripts/r883-native-emulator-lock-teardown.test.mjs
pnpm urai-jobs:verify
pnpm typecheck
pnpm build
URAI_ACCEPTANCE_SHA="$(git rev-parse HEAD)" bash scripts/run-r879-jobs-native-auth-acceptance.sh
```

Prove the original R879 native test runs against the 127.0.0.1 demo emulators, denies forbidden operators/owners, handles idempotency and 14 parallel quota creates, and leaves **no** synthetic job/queue/log/binding/quota-lock documents or users after exit. Preserve exact SHA, tool versions, raw logs and exit-code receipt; quota rate-limit consistency still needs deterministic interleaving analysis beyond a nondeterministic load probe.

**Production HOLD:** P1 [#337](https://github.com/LifeLoggerAI/urai-jobs/issues/337) actual native current-role acceptance, P2 [#345](https://github.com/LifeLoggerAI/urai-jobs/issues/345) transactional quota acceptance, P0 [#252](https://github.com/LifeLoggerAI/urai-jobs/issues/252) real privileged GCS future-write denial and in-flight upload drain. No signed owner-positive C6, protected Studio MP4/SRT, Replay or device live acceptance. **No production deployment, IAM change, paid compute, or real customer data touched.**
