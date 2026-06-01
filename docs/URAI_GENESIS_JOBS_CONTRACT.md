# URAI Genesis Jobs Contract

Last updated: 2026-06-01

## Purpose

This repository owns scheduled and asynchronous work for URAI Genesis once the main app loop is build-clean and staging-validated.

## Source of truth

Primary app repo: `LifeLoggerAI/UrAi`

Genesis data tree:

```txt
uraiGenesis/{userId}/state/consent
uraiGenesis/{userId}/state/passport
uraiGenesis/{userId}/state/moodWeather
uraiGenesis/{userId}/signals/{signalId}
uraiGenesis/{userId}/reflections/{reflectionId}
uraiGenesis/{userId}/memoryStars/{starId}
```

Every job must read consent before processing user data.

## Genesis job candidates

Launch-adjacent jobs:

```txt
[ ] Daily mood-weather recalculation
[ ] Weekly private reflection rollup
[ ] Memory-star clustering
[ ] Consent-state integrity audit
[ ] Passport review/export queue
[ ] Sound/asset availability validation
[ ] Failed Firebase-write retry queue
```

## Required safety rules

- Never process disabled consent categories.
- Never create externally shareable output without Passport permission.
- Never emit diagnostic, clinical, or certainty-based mental-health labels.
- Prefer private user summaries over raw-content exports.
- Emit operational health without leaking user content.

## Operational outputs

Jobs should report operational status to an admin-visible collection or dashboard layer without exposing private content:

```txt
jobRuns/{runId}
jobFailures/{failureId}
analyticsHealth/{date}/jobHealth
```

## Readiness checklist

```txt
[ ] Uses service credentials only in server/job environment.
[ ] Reads consent/Passport state before processing.
[ ] Has retry and dead-letter behavior.
[ ] Emits job health for admin.
[ ] Has staging-only dry-run mode.
[ ] Has production guardrails for destructive operations.
```
