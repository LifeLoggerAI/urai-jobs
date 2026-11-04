# R521 — ONE URAI Private Life Movie Durable Write-Fence Contract

**Status:** REVIEW-ONLY DESIGN / NOT IMPLEMENTED / GENESIS NO-GO.

**Owner:** URAI security and privacy release review. Linked P0: Jobs issue #252. Based on Jobs review #251 and the separate draft #253 hard-off Studio output-write guard. This RFC is an implementation acceptance contract, not deployment code or authorization to write media. The separate review-only test models are tracked in Jobs #254 and #255.

## 1. Why the existing green tests are not enough

The original Jobs cleanup safely checks generation-bound Storage deletion, owner/project scope, outstanding job status, and read-only Storage prefix inventory. On the R517 immutable Jobs #251 / Privacy #192 pair, original Firebase emulator tests passed 12/12 and 23/23 in synthetic review-only mode. Those checks are point-in-time. A streaming upload admitted before withdrawal can still complete after a snapshot; a previously granted service identity could also write after cleanup. A simple `control.check()` before upload, a Firestore job lease, an object's last metadata read, or a signed-url expiration alone does **not** establish lifetime future-write exclusion.

Draft Jobs #253 intentionally returns `false` from its direct private-output write-authority hook before both worker GCS streams. Preserve this unconditional denial until all independently reviewed production requirements below are met; do not add an environment flag, test receipt, stub grant, or caller-owned bool to enable it.

## 2. Threat model and invariant

Canonical revocation scope is **owner UID + purpose `life-movie.render` + tenant + project**. Authorized output Storage buckets are explicitly enumerated and locked to canonical prefixes. Worker, Studio, replay client, forged service identity, stale lease, old signed upload URL, default Admin SDK credentials, alternate bucket and direct GCS API must not be able to bypass the sole audited media-write authority. A given tenant/project may bind to one canonical owner only, and concurrent reservations may not reuse the same live object destination.

Safety invariants:

1. All writers of private derivatives use an authenticated, sole Storage-enforced write service. Workers have **no** direct write IAM on any approved output bucket/prefix; no prior signed upload URL remains valid across revocation. The storage/service policy is validated with *actual denied cloud calls*; the emulator cannot attest IAM.
2. Before any writable stream is handed to a worker, a server-owned **durable reservation** is atomically recorded against the current epoch and scope. The reservation includes the exact bucket/object name, generated opaque attempt ID, immutable project and output class. Never accept a caller-asserted owner, rights proof or token as authority.
3. Only independently granted, owner-noticed and current **C6 consent + per-source rights + subject/likeness authorization** can transition the service to accepting new reservations; each admission rechecks source identity and owner deletion.
4. Withdrawal first transitions the scope from `OPEN` to `FENCING` in a serializable transaction, increases a monotonic epoch and blocks all new reservations/resumes immediately. The old epoch is never reactivated. Retry of an already received revocation event is idempotent.
5. `FENCING` **does not** mean deletion complete. Every previously admitted stream must be confirmed physically closed/fenced or permitted to finish into an inaccessible quarantined object; all exact generations must be recorded and generation-bound deleted before ACK. A lease timeout, process restart, cloud eventual consistency or missing job output reference is not physical stream-close proof.
6. Finalization/publishing is a separate current-epoch transaction and fails after entering `FENCING`. A positive `REVOKED` acknowledgement is allowed only after all durable reservations have completed or are irreversibly fenced, all known generations have been reconciled, inventory of every approved bucket/canonical prefix is readable and empty, and the trusted write service plus IAM policy prevent any future writes. An orphan not attributable to a known attempt must be reconciled explicitly; no unscoped bulk deletion.
7. Private playback reauthorizes owner/subject, purpose, current consent, rights and revocation epoch on **every** request, regardless of cached manifests. No public or long-lived reusable bearer URLs; the review must explicitly handle CDN caches, signed URL lifetimes and client-side cached media.
8. Failure of Firestore, Storage list, signed-identity validation, policy attestation, broker registration, object generation readback, or consumer replay-rights check is **deny**, not success.

`OPEN -> FENCING -> REVOKED` is the only revocation path. A new positive grant, if legally approved, creates an independently reviewed fresh epoch and separate consent record; it cannot resurrect old attempts, files, paths, signed links or leases.

## 3. Required server-owned records and linearization points

| Record / boundary | Authoritative fields | Required atomic transition |
|---|---|---|
| Owner/purpose/project fence | ownerUid, tenantId, projectId, purpose, epoch, phase, revocationEventId, updatedByService | `OPEN -> FENCING` increments epoch once; conditional Firestore transaction |
| Write reservation | random server-generated attemptId, fence doc ref, approved bucket, exact canonical path, expectedEpoch, writer service principal, status | `RESERVED` created only in same transaction verifying `OPEN`, current C6+rights and no deletion |
| Stream state | attemptId, createdAt, storage session handle, expected generation, termination evidence, immutable token binding | Cannot become `CLOSED` from TTL alone; start/close attestations from sole writer |
| Media generation | attemptId, exact gs:// path, integer Storage generation, hash, content type, creation time | Reconcile by `ifGenerationMatch`; never clear refs on replacement or missing proof |
| Revocation completion | authoritative attempted generations, closed/aborted streams, read-only all-bucket inventory, audit evidence, epoch | `FENCING -> REVOKED` only after all invariants hold and no write path remains available |

The Firestore transaction can serialize **reservations and revocation state**, but GCS object creation itself is not part of the Firestore transaction. Compensating deletion, durable upload close attestation, quarantined staging and IAM-restricted broker are therefore required. Never equate Firestore atomicity with Storage physical atomicity.

## 4. Acceptance scenarios that must be implemented, not just modeled

1. Pause immediately after C6/rights preflight, withdraw, then try reserve/start/upload: deny before first private byte.
2. Pause a stream after first byte, withdraw, physically finish old stream: no publish, no early ACK; exact generation is pinned and deleted or quarantined until proven absent.
3. Crash after Storage object creation but before job `output` record: reservation persists; an orphan is discovered; final completion is denied pending explicit reconciliation.
4. Pause cleanup after its Storage inventory, then attempt late old-lease write: broker must deny, or hold completion until the known stream is closed/deleted; an inventory snapshot alone is insufficient.
5. Replay same revoked event, change job type aliases, manipulate tenant/project/bucket, forge owner/service principal, remove generation or inject newer generation: no authority or accidental deletion.
6. Attempt old session, old signed upload URL, worker Admin SDK direct `file.save`, alternate service account and alternate output bucket **after `REVOKED` ACK**: actual Cloud Storage API responds unauthorized/forbidden, not merely a logical application error.
7. Retry private replay, ranged request, signed download URL and cache fetch after withdrawal: authenticated denial and no residual reusable media URL.
8. Owner account deletion/disabled account, corrupt rights record, storage listing `403`/`5xx`, suspended IAM state, clock drift, lease expiration, process crash and duplicate workers: no false cleanup ACK.
9. Independently verify every approved bucket/prefix and no unreviewed GCS direct-write APIs, managed identity mappings, storage transfer jobs or other writers. Include private media replicas and derivatives.
10. Final staging proof uses immutable source SHA, exact deployed service identity, real cloud IAM policy at a cost-capped disposable test project, positive and negative token cases, provider-originated logs, bounded spend and rollback evidence.

## 5. Evidence and release gate mapping

Implementation evidence is deliberately split across independent draft review branches: [Jobs #254](https://github.com/LifeLoggerAI/urai-jobs/pull/254) contains the **9/9 disposable Firebase emulator reservation/epoch review model**, while [Jobs #255](https://github.com/LifeLoggerAI/urai-jobs/pull/255) contains a **17/17 deterministic Node race-model** (both source-scoped to their own review SHAs). Neither proves production GCS IAM or physical stream draining. **This PR #256 is documentation-only**, and contains no new executable broker, test suite, IAM policy, C6 issuer, real cloud negative test, worker activation or release authority.

**P0 #252 remains OPEN until all of the following are supplied:** approved broker implementation; secure migration that removes every direct writer's Storage IAM; source-bound and independently approved owner-noticed C6 rights authority; authenticated service workload identity; executable direct cloud API denial before and after revocation, active-upload draining across process crashes, generation-bound cleanup and multi-bucket inventory; genuine private H.264/SRT delivery in Spatial Replay with revocation/deletion; protected exact-head CI, hosted staging, rollback and independent security review. Explicit Founder Steward release authorization is still separate.

No branch merge, production deploy, service IAM change, new cloud spend, C6 grant, rendering, or release approval is authorized by this document. Every missing requirement is **NO-GO / HOLD**.
