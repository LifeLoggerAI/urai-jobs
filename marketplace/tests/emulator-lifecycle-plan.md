# Marketplace Emulator Lifecycle Verification Plan

## Critical execution priority

The marketplace backend is now:
- stateful
- permission-aware
- moderation-driven
- transaction-sensitive
- externally executable

Emulator verification is now mandatory before production deployment.

---

# Required lifecycle verification matrix

| Flow | Required Verification |
|---|---|
| Employer onboarding | Auth + persistence + ownership |
| Job creation | Ownership + moderation initialization |
| Job update | Ownership enforcement + persistence |
| Job close | Ownership enforcement + lifecycle transition |
| Moderation approve | Admin enforcement + publication transition |
| Moderation reject | Admin enforcement + rejection persistence |
| Resume upload | Signed upload expiration + auth |
| Application submission | Duplicate transaction prevention |
| Profile update | Auth + persistence |

---

# Required emulator suites

## Suite 1 — Auth verification
Must verify:
- invalid token rejection
- unsigned request rejection
- admin-only enforcement
- ownership enforcement

---

## Suite 2 — CRUD lifecycle verification
Must verify:
- employer creation
- job creation
- job updates
- job closure
- moderation approval
- moderation rejection
- profile updates

---

## Suite 3 — Transaction verification
Must verify:
- duplicate applications blocked
- transaction rollback behavior
- concurrent mutation protection

---

## Suite 4 — Upload verification
Must verify:
- signed upload generation
- expiration enforcement
- content type enforcement

---

## Suite 5 — Deployment smoke verification
Must verify:
- runtime startup
- route mounting
- firestore connectivity
- environment variable availability

---

# Production gate rule

Production deployment should be blocked unless:
- auth verification passes
- ownership verification passes
- moderation verification passes
- lifecycle verification passes
- upload verification passes

---

# Current status

| Area | Status |
|---|---|
| Route inventory | implemented |
| Security inventory | implemented |
| Emulator execution | pending |
| End-to-end lifecycle tests | pending |
| Deployment verification | partial |
