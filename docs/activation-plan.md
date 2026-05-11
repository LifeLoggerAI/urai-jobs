# URAI Jobs Activation Plan

Status: draft
Date: 2026-05-11

## Current repository role

This repository currently serves the URAI Jobs Runtime. The runtime handles internal job execution, queueing, worker dispatch, monitoring, retry, cancellation, reconciliation, and operator visibility.

## Activation direction

The requested jobs platform work should be delivered in a staged way:

1. Stabilize the existing runtime.
2. Verify build, tests, scripts, rules, and deployment docs.
3. Preserve the runtime boundary while planning marketplace expansion.
4. Add marketplace code only through a separated module with its own app, APIs, data model, QA, and release checklist.
5. Keep production launch gated until evidence exists.

## Phase 1: runtime stabilization

- Run repository verification.
- Run typecheck, build, tests, and smoke checks.
- Verify callable emulator tests.
- Confirm runtime deployment docs.
- Confirm rollback docs.
- Record evidence in the signoff ledger.

## Phase 2: marketplace readiness package

- Define candidate workflow.
- Define employer workflow.
- Define admin workflow.
- Define data model.
- Define storage paths.
- Define route map.
- Define QA matrix.
- Define launch checklist.

## Phase 3: separated marketplace implementation

Implement marketplace only after phase 2 is approved. Keep the module separate from runtime code. The marketplace should have its own app shell, API functions, data collections, storage rules, docs, smoke tests, and release evidence.

## Phase 4: preview and production release

- Deploy preview.
- Complete QA.
- Complete signoffs.
- Deploy production.
- Run production smoke.
- Tag release.
- Record rollback target.

## Launch rule

Do not mark production launch complete until verification evidence, signoffs, domain checks, legal/privacy review, and smoke tests are recorded.
