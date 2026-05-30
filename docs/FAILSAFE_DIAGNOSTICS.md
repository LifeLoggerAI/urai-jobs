# Failsafe Diagnostics

Jobs runtime must fail closed for missing production secrets and keep emulator-safe local defaults.

## Checklist
- Validate `.env.example` values for emulator mode.
- Keep worker URLs explicit; do not silently route to unknown endpoints.
- Keep auth and API origin allowlist checks enabled.

## Suggested command order
- `pnpm install --frozen-lockfile`
- `pnpm urai-jobs:verify`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm urai-jobs:smoke`
