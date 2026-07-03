# Blockers

Starting SHA: 9ad2137c2689e6aa936e72b0552a0a1913981714
Branch: production-lock-jobs-2026-06-30

## P0 production-lock blockers

1. Local/CI checks must pass: install, verify, typecheck, build, test, smoke, emulator E2E.
2. Staging Firebase Functions and worker deployment must be proven.
3. Staging narrator job must produce a real GCS artifact through a real worker.
4. Worker auth rejection and allowed invocation must be proven in staging.
5. Retry, fail, cancel, dashboard, monitoring, and rollback proof must be attached.
6. Production smoke must run only after staging passes.

## P1

- Add org-level scoping tests for multi-tenant jobs.
- Add log/payload redaction tests.
- Verify Storage rules and bucket IAM.
- Confirm all worker families have explicit implementation owners.

## P2

- Add UI status banner showing runtime environment and fallback disabled/enabled state.
- Add dashboard cards for missing worker URL config.

## P3

- Add screenshots to proof folders.
- Add retention snapshots for old logs and artifacts.
