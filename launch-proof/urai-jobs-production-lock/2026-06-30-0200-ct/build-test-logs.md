# Build / Test Logs

Starting SHA: 9ad2137c2689e6aa936e72b0552a0a1913981714
Branch: production-lock-jobs-2026-06-30

## Commands requested

- `pnpm install --frozen-lockfile` — BLOCKED — repo checkout failed because the execution environment could not resolve github.com.
- `pnpm urai-jobs:verify` — BLOCKED — checkout unavailable.
- `pnpm typecheck` — BLOCKED — checkout unavailable.
- `pnpm build` — BLOCKED — checkout unavailable.
- `pnpm test` — BLOCKED — checkout unavailable.
- `pnpm urai-jobs:smoke` — BLOCKED — checkout unavailable.
- `pnpm urai-jobs:e2e` — BLOCKED — checkout unavailable.
- worker/function/web tests — BLOCKED — checkout unavailable.

## CI required

Open PR and allow GitHub Actions workflow `.github/workflows/urai-jobs-runtime-ci.yml` to run. Do not merge as READY until CI is green and emulator E2E evidence is attached.
