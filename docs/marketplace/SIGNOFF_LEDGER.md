# Marketplace Signoff Ledger

Status: launch-gated
Date: 2026-05-11

Production release is blocked until every required row is marked VERIFIED with evidence.

| Gate | Required evidence | Status | Signer | Date | Evidence link or note |
|---|---|---|---|---|---|
| Product scope | Approved marketplace MVP scope and deferred scope | BLOCKED | TBD | TBD | Marketplace module not implemented |
| Engineering architecture | Marketplace separated from runtime and reviewed | BLOCKED | TBD | TBD | Separate module required |
| Runtime verification | Runtime verify, typecheck, build, test, smoke, emulator E2E | IN_PROGRESS | TBD | TBD | Existing scripts present; latest run not recorded |
| Candidate workflow | Jobs list, detail, auth, profile, resume, apply, status, withdraw | BLOCKED | TBD | TBD | Marketplace module required |
| Employer workflow | Lead/org, post job, dashboard, applicants, status update, boundaries | BLOCKED | TBD | TBD | Marketplace module required |
| Admin workflow | Claim enforcement, moderation, review tools, non-admin denial | BLOCKED | TBD | TBD | Marketplace module required |
| Data access rules | Candidate-owned, employer-scoped, admin-only, deny-by-default | BLOCKED | TBD | TBD | Marketplace rules required |
| Storage access rules | Resume privacy and company asset boundaries | BLOCKED | TBD | TBD | Marketplace storage rules required |
| Legal/privacy | Terms, privacy, export, delete, retention reviewed | BLOCKED | TBD | TBD | Legal review required |
| Deployment | Preview deploy, production deploy, rollback path documented | BLOCKED | TBD | TBD | Marketplace deploy path required |
| Domain/SSL | Apex and www verified | BLOCKED | TBD | TBD | Production domain verification required |
| Production smoke | Homepage, health, jobs API, auth, apply, employer, admin checks | BLOCKED | TBD | TBD | Production deployment required |
| Release notes | Changelog, tag, known gaps, rollback target | BLOCKED | TBD | TBD | Release not cut |

## Evidence rules

- Use VERIFIED only when the command, test, review, or smoke check has real evidence.
- Use BLOCKED when implementation or external setup is missing.
- Use IN_PROGRESS only while actively gathering evidence.
- Do not use DONE without a link, command output, PR, screenshot, or written approval note.
