# URAI Jobs Marketplace Module

Status: scaffolded, launch-gated

This module is intentionally isolated from the URAI Jobs Runtime.

It will own the public candidate, employer, and marketplace admin surfaces after implementation approval and verification.

## Directory layout

- `app/` public route shell and static frontend entrypoints
- `functions/` marketplace API namespace
- `rules/` Firestore rules draft for marketplace collections
- `storage/` Storage rules draft for resumes and company assets
- `tests/` launch-gate and contract tests
- `docs/` module-local notes

## Current state

This is a scaffold. It defines boundaries and executable launch gates, but it does not yet implement production candidate or employer workflows.

## Launch rule

Production release is blocked until:

- marketplace API implementation exists
- route shell exists
- Firestore rules are tested
- Storage rules are tested
- candidate workflow is verified
- employer workflow is verified
- admin workflow is verified
- signoff ledger is complete
- deployment smoke evidence exists
