# R857 — Physical Generation Accounting Prototype (Review Only)

Status: **DRAFT / NOT A STORAGE FENCE / Jobs #252 P0 OPEN / GENESIS HOLD**.

## Source ancestry and limits

Candidate is a direct descendant of [Jobs R856 PR #327](https://github.com/LifeLoggerAI/urai-jobs/pull/327) source `d4de98894fcf5b835650b1a2fb86f98d30021f1b`. Preserve [R854 negative proof](https://github.com/LifeLoggerAI/urai-jobs/pull/325) and [R855 acknowledgment repair](https://github.com/LifeLoggerAI/urai-jobs/pull/326). Existing `workers/studio-worker/private-output-write-authority.js` must remain unconditional hard-OFF.

The existing `lifeMovieWriteReservationsReview.ts` supported Firestore-only `RESERVED` and `SIMULATED_IN_FLIGHT` states. R857 adds a review-only, emulator-gated physical generation observation to the **same** original ledger:

- `reviewOnlySyntheticOutputObjectPath` derives a canonical owner/tenant/project/attempt-local path rather than accepting untrusted arbitrary GCS URIs.
- `assertReviewOnlyBrokerPreByte` checks the current Firestore fence immediately before *synthetic* bytes. It is **not** storage-enforced; a writer can pause after the check.
- `recordReviewOnlyBrokerPhysicalGeneration` preserves a real disposable Storage emulator object generation in a durable Firestore attempt record. It accepts a late observation during `FENCING`, retains state `PHYSICAL_GENERATION_UNVERIFIED`, enforces idempotent replay of the same generation, denies conflicting replacements, and never returns a production upload grant or deletion acknowledgment.
- `reviewOnlyDrainStatus` treats this recorded generation as unresolved even if the object later vanishes from a point-in-time Storage read. It cannot say that all old streams or credentials are dead.
- `scripts/life-movies-review-only-physical-broker.firebase-emulator.mjs` runs the original source against disposable Firebase Firestore and Storage. It checks prebyte revoke veto; recording a genuine emulator Storage generation observed after withdrawal; idempotency and conflicting generation rejection; outstanding attempts after deletion; and intentionally reproduces the **unattributed privileged Admin bypass** even with zero reservations.

## Test plan

Use detached, clean, source-pinned Jobs candidate on a clean environment (Node 22, pnpm 8.15.9, Java 21), isolated HOME/XDG/CLOUDSDK_CONFIG and **no cloud credentials**. First run original frozen install / full verification / typecheck / build. Next execute the original R854 negative runner at the R857 SHA, and independently run the newly added Firebase source test in `emulators:exec --only firestore,storage` at project `urai-staging-test` with `URAI_EMULATOR_PROJECT=urai-staging-test`.

Do not imply test success until the final native command and exact source commit are independently observed. Original hashes, stage logs, source status and full exits must be preserved in GitHub and the master registry. Do not deploy, grant IAM, unlock Studio, transmit real media or use a production project.

## Not yet addressed

The Firebase Admin SDK can always write to emulator Storage without honoring Firestore consent. Production requires an **exclusive scoped broker identity**, verified effective GCS IAM (all legacy worker/revision/group/service account/alternate bucket paths denied, ideally actual data-plane 403), durable network upload admission/drain with real generation-bound cleanup, owner/source-rights and signed positive consent, no reusable signed URLs, protected Replay, protected CI and independent deployment review. No review-only return value may be interpreted as an actual revocation completion receipt.

**Current security state: storageWriteFenceVerified=false; privateOutputDeletionAcknowledged=false; productionAuthorized=false.**