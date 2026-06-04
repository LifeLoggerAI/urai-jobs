# URAI Jobs Public Product Boundary

Status: active
Date: 2026-06-04
Related decision: `docs/product-decisions/PDR-001-autonomous-urai-jobs-v1-v5.md`

## Purpose

This document defines the boundary between the existing URAI Jobs Runtime and the separated public autonomous URAI-Jobs product surface.

The runtime is the execution fabric. The public product is the user-facing career and economic navigation experience.

## Runtime boundary

The runtime may own:

- Job type contracts.
- Queue routing.
- Worker registry configuration.
- Callable orchestration.
- Job state, logs, retries, leases, reconciliation, and release evidence.
- Artifact references and output manifests.
- Worker health verification.
- Production smoke and rollback evidence.

The runtime must not become a public marketplace UI, a candidate dashboard, an employer dashboard, or a general user profile store.

## Public product boundary

The public product surface may own:

- Career Mirror onboarding.
- Work preference profile.
- Opportunity discovery UI.
- Opportunity save, hide, and explain-match controls.
- Candidate profile.
- Employer profile.
- URAI Passport career identity.
- Draft packet review.
- Interview preparation room.
- Offer comparison view.
- Spatial career portals.
- Economic path graph.

The public product may call the runtime through approved job contracts and must never bypass the runtime's auth, logging, queue, and evidence layers for long-running or sensitive work.

## V1 boundary

V1 may include:

- Career Mirror shell.
- Work preference profile.
- Manual opportunity discovery.
- Save and hide controls.
- Explain-match panel.
- Basic fit scoring through `career.fit.score`.
- Career profile summary through `career.profile.summarize`.

V1 must not include unreviewed external actions or hidden outbound workflow.

## V2 boundary

V2 may include:

- Candidate profile.
- Employer profile.
- Opportunity list and detail pages.
- User document storage with reviewed rules.
- Document parsing through `career.document.parse`.
- Document tailoring through `career.document.tailor`.
- Draft packet generation through `career.packet.generate`.

All prepared materials remain user-reviewed artifacts.

## V3 boundary

V3 may include:

- User-defined rule builder.
- Strict eligibility and exclusion filters.
- Quality and duplicate detection.
- Execution ledger.
- Artifact snapshots.
- Follow-up planning through `career.followup.plan`.
- Global pause and per-rule pause.

All automation must be explicit, logged, pausable, and revocable.

## V4 boundary

V4 may include:

- Interview prep through `career.interview.prep`.
- Offer comparison through `career.offer.compare`.
- Work-style fit analysis.
- Burnout-risk forecast.
- Spatial portals through `career.spatial.portal.generate`.

V4 connects decision intelligence to URAI Spatial without moving spatial rendering responsibilities into the public product module.

## V5 boundary

V5 may include:

- Economic path graph.
- URAI Passport career identity through `career.passport.export`.
- Compatibility matching design.
- Skill-gap engine.
- Project recommendation engine.
- Long-term income path map.
- Founder, freelancer, employee, student, and rebuild modes.

## Required controls

Every public product call into the runtime must include:

- Authenticated user or service identity.
- Tenant or workspace scope.
- Correlation ID.
- Idempotency key.
- Dedupe key where applicable.
- Explicit target system of `JOBS`.
- Non-sensitive payload references for private artifacts where possible.
- User-visible status or evidence for long-running jobs.

## Prohibited data sharing

The public product must not expose raw private URAI behavioral, emotional, sensory, mental-health, or relationship data to employers or third parties.

Employer-facing or third-party-facing material must use abstracted, user-approved, revocable profile packets.

## Acceptance

This boundary is satisfied when runtime code, public product code, tests, documentation, and release evidence all respect the separation between execution fabric and user-facing career product.
