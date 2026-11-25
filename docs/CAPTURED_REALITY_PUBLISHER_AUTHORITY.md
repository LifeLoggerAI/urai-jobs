# Private runtime publisher authority repair

Stacked source handoff over Jobs #162. The active Spatial convergence branch and
the existing reconstruction, private-source, Life Movie and Studio source lanes
are unchanged.

The private runtime publisher now reads both canonical consent blocks and the
existing permanent owner-deletion fence within the Firestore transaction that
admits or replays the runtime receipt. A changed consent/deletion document forces
transaction retry and denial; a successful retained job cannot bypass owner
deletion. The final transaction also binds the exact callback hash, opaque
artifact reference, byte count, reconstruction method and Spatial authority SHA
from the pre-redemption job. A changed binding cannot admit older artifact bytes.
The receipt and immutable object metadata retain a hash of that complete binding;
replay cannot transfer an older callback/artifact authority to a changed job.
Legacy unbound receipts remain preserved and fail closed, requiring deliberate
owner-governed reconciliation rather than automatic promotion.

Identical simultaneous publications replay the winning exact receipt. A rejected
publication compensates only its retained Storage generation. Failed compensation
persists an owner-scoped `capturedRealityRuntimeCleanup` record rather than a usable
admission. Canonical consent/account deletion retries those exact generations;
ordinary admission cleanup fences access before Storage and retains a pending
state until physical removal succeeds. The new collection is server-owned and
falls under the existing default-deny Firestore rules. Cleanup uses 100-record
owner pages rather than rejecting an owner with more than 500 runtime records;
completed acknowledgements remain replay-safe and foreign records are preserved.

`scripts/captured-reality-runtime-publisher-smoke.mjs` transpiles and executes the
actual request handler and deletion helper with explicitly synthetic Firestore,
Storage, credentials and artifact bytes. It covers consent/deletion races,
Firestore optimistic retry, callback/artifact/size/source changes, deterministic
replay/concurrent publication, fixity, revoked receipts and retryable Storage
cleanup. The pre-repair #162 source returns HTTP 200 in the consent-race test.
The smoke is included in the existing repository verification command.

These are source and synthetic-adapter checks. No real private source, deployed
runtime, CUDA reconstruction, provider execution, accepted world/navigation,
identity/literal film, browser/device/XR acceptance, independent approval or
production deployment is established. Runtime admissions remain technical-unreviewed,
hard-off and candidate/public acceptance false. A runtime process loss or Storage
and Firestore outage still requires deployed lifecycle/cleanup evidence; no full
ecosystem deletion certificate is inferred from these local tests.
