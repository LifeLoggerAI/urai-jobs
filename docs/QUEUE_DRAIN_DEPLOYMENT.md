# URAI Jobs Queue Drain Handoff

Updated: 2026-10-10. Source reviewed: Jobs owner #170 at
`79f43bd291df535eb79b3a8502c018a99afd7b21`.

Queue drainage is a runtime operation that can dispatch workers and incur provider
costs. Production remains **NO-GO** until the existing release owner establishes
the required source, environment, privacy, runtime and independent approval
evidence. This handoff grants no deployment, queue mutation or launch authority.

## Preserve the current owner and launch gate

Continue source work through the existing Jobs owner #170. Its reviewed candidate
is distinct from `main`; green component checks do not admit it to production.
Read the current owner and main identities before preparing any further change.
Preserve local changes and the current branch; do not reset a checkout to main as
a queue diagnostic step.

The [launch lock](../verification/launch-lock.json) remains
`locked_until_verified`. It requires the listed checks and
[manual signoffs](../verification/signoffs.md) before ready/merge/production
release. Source validation and historical signoff text do not establish current
environment health, exact-candidate approval or authentic runtime acceptance.
This is a release gate, not a claim that the deployment YAML contains an
unconditional production-disable switch.

## Use the canonical deployment authority only after approval

[URAI Jobs Canonical Production Deploy](../.github/workflows/urai-jobs-production-deploy.yml)
is the deployment workflow. Its source checks require the main ref, the exact
target SHA, a distinct ancestor rollback SHA supplied under the existing approval
process, target-specific confirmation, rollback configuration fingerprints and exact numeric secret
versions. It performs credential-free validation first, then a protected
environment mutation phase using workload identity, and separately verifies the
result against immutable receipts. The
[deployment authority guard](../scripts/verify-deploy-authority.sh) also checks
the clean source and rollback ancestry. These technical checks do not substitute
for release-owner or independent approval.

The old [production-deploy-publish workflow](../.github/workflows/production-deploy-publish.yml)
is disabled and emits a notice only. A successful notice job is not a deployment.
The [legacy dispatch wrapper](../scripts/run-deploy-publish-workflow.sh) still
targets it with obsolete inputs; do not run that wrapper or override its workflow
target. The May 20 reset, launch-unlock, worker-dispatch and skipped-smoke recipe
is retired. Do not invoke underlying worker or Firebase mutation scripts as an
alternative to the canonical authority path.

## Keep source evidence separate from queue execution

The [queue wiring verifier](../scripts/queue-runtime-verify.mjs) checks source
markers. It does not drain a queue or prove scheduler or Pub/Sub delivery.
The [Runtime CI callable proof](../.github/workflows/urai-jobs-runtime-ci.yml)
starts Auth, Firestore and Functions emulators. Its passing results do not prove
the complete deployed scheduler, Pub/Sub, worker, Storage, terminal-event and
notification chain. Use the current
[runtime job registry](../functions/src/core/runtimeJobTypes.ts) for active
families; do not activate historical or future job types from older handoffs.

The Jobs owner, with Studio and Privacy owners, must bind an admitted source,
environment, current actor, input, consent and permitted worker/provider scope
before runtime verification. Retain exact-source evidence of leases, retry
limits, cancellation, consent withdrawal, terminal events and downstream cleanup.
Any synthetic adapters and unexercised services must remain explicit.

## Handoff when a queue is stalled

An authorized operator first retains read-only evidence: deployed source and
configuration identities, job/queue state, lease identity, available-at time,
scheduler and Pub/Sub delivery logs, and worker/terminal-event receipts. Keep
private payloads and credentials out of shared evidence. A queued item or a
historical screenshot alone does not identify the cause.

Do not invoke `processQueueNow`, retry/requeue jobs, enable schedules, deploy or
roll back merely to produce a passing result. Those actions require the existing
operator's approved scope and current authority. Record the observed blocker and
route it to the Jobs owner. Any approved rollback must retain the canonical
source/configuration provenance and post-operation readback; this handoff does
not authorize one.
