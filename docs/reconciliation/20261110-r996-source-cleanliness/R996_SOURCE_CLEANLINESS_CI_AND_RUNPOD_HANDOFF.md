# ONE URAI Genesis - R996 Git checkout reproducibility and CI failure review

**2026-11-10 UTC | REVIEW ONLY | PRODUCTION HOLD / NO-GO**

## Authoritative parent and changes

Parent Jobs PR #395: `review/chalk-r995-idempotent-pinned-checkout-20261110` at `7ab9f7b6566e7ba1b23d97ba2174debace570235`, itself a child of Jobs PR #394 at `32d778fa70a9d144a7fd235a80ba9827c504da75`. Review-only R996 adds a successor helper `scripts/r996-safe-pinned-git-checkout.sh` and tests `tests/r996-safe-pinned-git-checkout.test.sh`, preserving the R995 code without modifying it. R995 originally passed 14 local tests.

## Actual bug reproduction

The original R995 helper used `git status --porcelain --untracked-files=all`. Reproduced with a newly created local Git repo and a `.gitignore` that ignores `node_modules/`: after writing a hidden dependency file under `node_modules/`, the original helper printed `R995_CHECKOUT_REUSED` despite untracked ignored content. The Git output `git status --porcelain=v1 --untracked-files=all --ignored=matching` correctly reported `!! node_modules/`.

Two more bypasses were independently reproduced using local Git: both `git update-index --assume-unchanged index.js` and `git update-index --skip-worktree index.js` masked malicious edits from ordinary Git status while HEAD remained pinned. `git ls-files -v` exposed the flags as `h index.js` and `S index.js`.

R996 fails closed on any modified, untracked **or ignored** entries; it also rejects any lowercase index flag or uppercase `S` in `git ls-files -v`. The test-only URL switch is now `R996_ALLOW_LOCAL_TEST_URL`, disabled by default. Existing directories are never deleted or changed by the refusal path; on an initial failed fetch, only R996's private staging directory is removed.

## Executed verification and source bytes

- Local Bash syntax on helper/test: PASS.
- First run `bash tests/r996-safe-pinned-git-checkout.test.sh`: **19/19 PASS**.
- Three repeated full suite runs: **19/19 PASS each**.
- After naming the test-only override consistently, rerun: **19/19 PASS**.
- Helper source SHA256: `260be5a9908ecef78de5e599e3b67875f7991bcbe1e82fc57e4f7b8747246de6`.
- Test source SHA256: `353db6b1d88b9ea3d3976998741ac8ada133ea45a3c1d5bca4a172ebb57ddf15`.
- Git blob helper SHA: `1d941569a518cdf934462dd1a0bd71d9cf08ac7c`.
- Git blob tests SHA: `3c4553d2d7f406406d0925599bd9d59037b9b58b`.
- GitHub connected `fetch_file` readback matched both local Git blobs exactly.
- The local runtime could **not reach github.com DNS**; only local bare Git repo fetch/reuse was exercised. Do not claim fresh GitHub network-clone acceptance.

## GitHub Actions: verified infrastructure limitation, NOT a model or product test

Jobs PR #395 had **nine GitHub Actions workflow runs**, all reporting `conclusion=failure`; individual jobs presented empty `steps=[]`. Six inspected job log requests returned `404 BlobNotFound`. The callable emulator E2E job was skipped. Two `actions/runs/{id}` records confirmed the failures and head SHA. No underlying test failures could be diagnosed from these absent runner logs; **protected CI remains red/unverified**, not accepted. A specific historic sibling PR #394 separately reports failed Firebase emulator JAR download and incomplete authenticated lifecycle acceptance. Do not conflate the two failure classes.

## Runpod read-only census and costs

As observed, 328 owned pods were listed and three RUNNING:

- `sr5f5s1vancs9o` R955 Studio/Jobs integration diagnostic, CPU listed rate $0.16/hour; repeated clone destination failure, no qualified native acceptance.
- `75udipo6j06l7o` R954 Jobs verify diagnostic, $0.16/hour; repeated already-existing checkout destination failure.
- `bvandlyauxhevl` R950 late-write reserved pod, $0.08/hour, top-level `sleep infinity`; could be intentionally reserved.

Combined **listed compute rate $0.40/hour**, excluding volume/storage. Runpod 24-hour rolling query `2026-11-09T08:00:00Z` through `2026-11-10T08:00:00Z` returned **$5.440060517692473** account-wide: public endpoints $0.3060478197876364, pod CPU $5.0549386432539904, pod disk $0.05671294433705043, other storage $0.022361110313795507. Billing windows/reporting totals vary; this is **not** a provider job-by-job invoice reconciliation. No pods were stopped/restarted or mutated, and R996 incurred zero additional paid inference calls.

## Execution boundaries and next Chalk

1. Review R996 PR and its fail-closed tests independently; retain original R995 source and all evidence.
2. Accept an exact frozen Jobs commit and origin from owning PR before reusing a verified checkout. A real production execution must use the new helper **before** installing dependencies; once `pnpm install` creates ignored directories, repeated checkout preflight will reject unless run in a clean new destination. This strictness is intentional; do not delete unreviewed forensic files.
3. Confirm custody for the three active CPU pods and preserve logs before authorized stop/start; consider reducing waste once owners hand off. R996 has NOT been installed or run on those pods.
4. Diagnose GitHub runner/log infrastructure from GitHub support/provider side, not via fabricated green checks. Restore protected CI and emulator acceptance.
5. Finish authenticated Privacy -> Studio -> Jobs -> protected Replay -> downstream revocation and deletion, plus physical device, accessibility, AAA visual and rollback validation.
6. Preserve the research model evidence separately: R994 had 105 archived provider job IDs, known per-job reported cost $0.24738189 with three unresolved expired results; this is NOT a verified provider invoice or proof of original Chalk/Cheese/Council identity.

**NO MERGE / NO PRODUCTION RELEASE.**