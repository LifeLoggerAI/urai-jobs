# CHALK R1250 — source-locked markdown-it/linkify-it high advisory reduction, HOLD

Execution: 2026-11-13 Central / 2026-11-14 UTC. Parent Jobs #504 review merge `710f386c5fe495c63ddac42e62b45fcb93bcd6ef`.

Scope: only two scoped pnpm overrides `linkify-it@5.0.0: 5.0.2`, `markdown-it@14.1.0: 14.3.3` plus deterministic pnpm-lock.yaml re-resolution. All application source, Firebase Rules, private GCS IAM, consent protocol and release authorization untouched. No added lodash risky release; existing override preserved. No production mutation.

Original R950 source-locked execution at review branch head `7eb491386aae59ca48447f443c4940d897482ee3`: Git blob `package.json` `d8fac4c96a0c2946d1de14e2a28fe1f466efa49b`, `pnpm-lock.yaml` `defa5789dd7cf8ba491fb51acc7bf593f83957c3`. Independent GitHub clone matched tested local bytes 2/2. Node 22.23.0, pnpm 8.15.9:
- Frozen install `pnpm install --frozen-lockfile` exit **0**, original log SHA256 `cf3170aca4b004b529058c023ce869f353a83b1dfc0b359a91a220216a8b35e9`.
- Jobs Functions build exit **0**, original log SHA256 `935134f5ac3cdca13947d3e5ec6d250e05c7c24afe16f51c64d350d37e7de9a5`.
- Original GCS writer separation + cancellation tests `node --test scripts/review-only/r1088-writer-separation-canary.test.mjs scripts/review-only/r1122-gcs-session-cancel-canary.test.mjs`: **24/24 PASS, zero failures, exit 0**, original TAP SHA256 `d4dbccc841a8f9f2b59f74d7879816dccfe8d87f24cd60a2cfd78b3ea294a4dd`.
- Actual `pnpm audit --prod --json` exit **1**; critical **0**, HIGH **10**, moderate **27**, low **7**. Original JSON SHA256 `00ce3330ababfed9bac323583e2130e99d06c92c6b276353d43a31a8755581b7`. Previous merged Jobs #504 had HIGH 14, moderate 30, low 8. This clears two `linkify-it` and two `markdown-it` HIGH findings. Audit still **NOT PASS**.
- Original evidence on R950 `/tmp/urai-r1250/remote-{install.log,build.log,security.tap,audit.json}`, no production secrets intended; review notes are sanitized.

**Never interpret scoped PASS as independent certification:** the cross-repo owner-positive consent→Studio→Jobs→Replay→generation-delete, live exclusive broker GCS IAM, stale uploader revocation/draining, signed real owner identity, GitHub protected CI, credential incident closure, externally qualified security/privacy/accessibility approvals, device/stores, and founder GO remain open. Release **HOLD_NO_GO**, private-memory writes **DISABLED**, eleven launch gates **BLOCKED**. Merge this only into the review branch after source pin checks; do not promote `main`.
