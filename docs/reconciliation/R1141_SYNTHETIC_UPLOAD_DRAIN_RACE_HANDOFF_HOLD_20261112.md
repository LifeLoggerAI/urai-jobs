# R1141 — Synthetic upload-drain and stale-writer model (REVIEW ONLY / HOLD)

**Parent:** Jobs #488 at exact `5b5035ff2e5b036dd09aa215d61566e12930a0fb`. New branch is additive, two JavaScript files and this handoff. Existing runtime, IAM, CI, production deploy and privacy controls are not modified.

## Why
Jobs issue #252 establishes the true P0 property: after verified owner withdrawal, no old or alternate writer may create private derivatives, and deletion cannot be acknowledged while admitted uploads or exact generations remain unresolved. Existing R1122 tests establish only a *single* synthetic resumable-session cancellation. Point-in-time object listing alone does not prove absence of future writes.

## Execution
An independent local Node test run before publication used the source and tests in this branch (no network, credentials, real users, cloud IAM or customer data), and reported **12/12 PASS**, **40,320 bounded event schedules**, **34,912 premature synthetic readiness denials**, **5,408 synthetic eligible schedules**. The counts are outputs of this finite abstract state model; not a stress test of the actual worker, an external-runner pass, physical IAM test or deletion certification. An explicit weak-inventory counterexample proves the *abstract design* fails if a stale writer can complete after a one-time inventory, not that current Jobs production does this.

Run: `node --test scripts/review-only/r1141-drain-race-model.test.mjs`.

## Safeguards
No production code changed. No `package.json` enrollment: the test deliberately cannot become a release check before independent reviewer approval. State transitions model epoch-stamped reservations, withdrawal fencing, admitted session cancellation, generation-bound 404, independent effective IAM and principal identity checks, and a synthetic-only readiness result. Provider receipts are **simulated truth inputs**, not discovered or cryptographically verified. Real GCS cannot be certified by this model.

## Remaining P0 / next owner
- Create an authenticated, approved isolated GCS principal and bucket setup; verify inherited effective IAM and sole broker writer+reader.
- Real retired/alternate principal HTTP 403 on object metadata/media while a synthetic generation is present, not 404 on a missing bucket.
- Implement durable server-side reservation registry, all active session URI cancellation and session inventory, stale-writer generation checks, byte-race stress, signed URL/cache denial.
- Independently test the exact latest Jobs/Privacy/Studio source, positive owner-authorized C6 through private Replay and full withdraw/delete.
- Close Labs #370 potential Runpod credential exposure with restricted provider revocation receipt.
- Restore protected CI and external security approval; complete nine-stage Spatial/device/store/rollback and full estate merge review.

## No-loss handoff
Read Jobs #252; R1122 single-session canary source `c335b23c7b10522b17085d3c098a112440b2cb47`; Jobs #488 and Privacy #298 Runpod receipts; Labs #404/#406 handoffs. Preserve all other workers and 5 existing RUNNING Pods, do not relabel synthetic passes as live certifications. Production **HOLD / NO-GO**, private-memory writes **DISABLED**.
