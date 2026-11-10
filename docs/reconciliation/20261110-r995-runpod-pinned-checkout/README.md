# ONE URAI GENESIS - R995 exact-source checkout recovery

**Research/engineering review only; production HOLD.** Date: 2026-11-10 (UTC). This handoff continues the R994 105-job receipt crosswalk without adding paid Runpod model calls or changing production. This patch is a reusable checkout preflight and does not alter the already-running Runpod containers.

## Authoritative source and integration state

- Jobs candidate: `LifeLoggerAI/urai-jobs` PR #394, head `32d778fa70a9d144a7fd235a80ba9827c504da75`, base `review/chalk-r973-studio-producer-zod-enrollment-20261109` at `5fc1def0be77c75f7d9073efbeb41599d4dcd717` at inspection. It contains Studio #202 integration and native test-harness repairs, but protected CI and authenticated Firebase acceptance remain blocked; do NOT merge based on this R995 check.
- Studio candidate: `LifeLoggerAI/urai-studio` PR #202, head `501ac5c325f906cdeb32b0638dd15f5622ea1304`, remains open/unmerged.
- Benchmark/research: `LifeLoggerAI/urai-labs-llc` R994 PR #358, head `a539f6007294390c66741c22ea6ee6ac5504d239`, remains open/unmerged with CI startup_failure. R994 archived 105 unique provider job IDs, $0.24738189 in known job-reported charges, and three R991 jobs of unknown cost. These are not provider-invoice totals, and they do not certify original Chalk/Cheese/Council model identities.

## Live Runpod root-cause proof (read-only)

- Pod `75udipo6j06l7o` (R954; $0.16/hour) repeatedly logs `fatal: destination path '/tmp/r954-verify-debug/repo' already exists and is not an empty directory.` The existing startup command unconditionally clones into that persistent path.
- Pod `sr5f5s1vancs9o` (R955; $0.16/hour) repeatedly logs `R955_FINAL_EXIT=128` and SHA-256 of `clone.log` `987fe83335f1cecb3c48cc95ec35ea436788a28ddce0a1e4de71af81301b205e`. Independently hashing the exact string `fatal: destination path '/tmp/r955-jobs-integration/repo' already exists and is not an empty directory.\n` yields that same digest. This establishes the clone-destination failure despite redirected raw output.
- Pod `bvandlyauxhevl` (R950; $0.08/hour) is RUNNING with a top-level `sleep infinity` command; it might be intentionally reserved. No custody assumption has been made.
- The three listed CPU rates total $0.40/hour before any separately billed storage. A 24-hour Runpod billing query reported $5.247307675184857 total and $0.21442997851409018 public-endpoint portion at inspection; totals reflect the reported query window and may evolve.
- Do NOT interpret these bootstrap failures as evidence that the Studio->Jobs source logic failed. Do NOT reset/terminate anyone else's running pod to force a test result.

## R995 implementation

`scripts/r995-safe-pinned-git-checkout.sh REPO_URL FULL_SHA ABSOLUTE_TARGET_DIR` performs exactly one fresh fetch into a hidden staging directory and publishes it only when it passes exact Git HEAD, origin, source-tree, and clean-worktree verification. On rerun, it validates/reuses a matching clean checkout without an unnecessary network call. It rejects a dirty checkout, wrong SHA, wrong origin, non-Git directory, symlink, nested checkout, invalid SHA or unsupported URL without deleting that location. On a failed initial fetch, it cleans only its private temporary staging directory.

The production URL is restricted to `https://github.com/LifeLoggerAI/urai-jobs.git`. A `file://` test origin is accepted only when `R995_ALLOW_LOCAL_TEST_URL=1`; never enable that switch on production workers. Requires Bash, Git, GNU coreutils `timeout` and `mv -T`. It does not use secrets.

**Test-only executed verification:** `bash -n` on helper and test file PASS; `bash tests/r995-safe-pinned-git-checkout.test.sh` => **14/14 PASS**. Tests create a local bare Git repository under a temporary directory, including a true source fetch, no-network reuse, 12 denial/integrity scenarios, and clean cleanup. There were **zero new paid Runpod calls** for this verification, and zero modifications to active pods.

## Safe future use (NOT automatically wired to any current pod)

R954 original pinned checkout:

```bash
bash scripts/r995-safe-pinned-git-checkout.sh \
  https://github.com/LifeLoggerAI/urai-jobs.git \
  7e13bac4c1ae9d07e8bb2c87be7a91ff946828fe \
  /tmp/r954-verify-debug/repo
```

R955 original pinned checkout:

```bash
bash scripts/r995-safe-pinned-git-checkout.sh \
  https://github.com/LifeLoggerAI/urai-jobs.git \
  b498f66aff2f81e806cb2d37667a5bcb4d5c255b \
  /tmp/r955-jobs-integration/repo
```

The helper **must not** replace the full R954/R955 test runner. It is a single preflight before dependency installation/acceptance. If an existing checkout is dirty, mismatched or incomplete, fail and investigate; use a fresh explicitly chosen destination rather than wiping the evidence. Updating the existing pods' immutable `cmd` would require deliberate operator action and potentially a restart with container-disk loss; not attempted.

## Current release gates

GitHub protected CI startup failures; independent reviewer and merge approval; authenticated Privacy->Studio->Jobs->protected output->Replay->revocation/deletion evidence; physical device/UX/accessibility acceptance; visual founder signoff; and rollback target validation remain outstanding. This R995 offline helper test does not satisfy any of those gates. **ONE URAI GENESIS PRODUCTION HOLD / NO-GO.**

## Future Chalk instructions

1. Read the R995 PR diff and the 14-test receipt before running the helper in a paid environment.
2. Confirm the requested source SHA with the owning Jobs PR, not with the highest round number.
3. Reconfirm current Runpod pod status and custody, plus billing; don't infer that a pod's top-level command is useful just because its status says RUNNING.
4. Wire this helper into a new reviewed Runpod diagnostic orchestration command, not the currently running pods; retain complete logs and exact source/test hashes.
5. Finish the original R879 authenticated acceptance and independent review before contemplating merge or release.
