# R1736 — signed private-output review receipt verification contract

**Review-only, no production runtime integration.** Does not attest to any Google Cloud Storage action. This is not a Google-issued statement, a GCS provider signature, an authorized `life-movie.render` grant, or an IAM certification.

## Scope
The `signed-broker-evidence-review.mjs` verifier accepts only canonical compact signatures using a locally configured, pinned RSA-2048+ public key (`RS256`). Header shape, key ID, issuer, audience, owner, tenant, upload ID, epoch, session digest, object-name digest, completed generation, timestamps and one-time receipt ID must match exact expected values.

The verifying service MUST pin keys from an independently approved trust store; a caller must not supply keys or trusted `nowSeconds` in a real deployment. Tests use locally generated ephemeral RSA keys only.

The verifier returns `reviewSignatureVerified` rather than `authentic` to **avoid confusing a signature over claims with proof of actual provider state**. Even a genuinely signed receipt is not a reliable source of the underlying GCS cancellation, generation deletion or object absence unless a trusted, independently verified control plane obtained those facts. No production service verifies them here.

## No operational trust bridge
- **No GCS API calls, real session cancellations, IAM policy checks, object reads/deletes, or provider-owned upload-state evidence.**
- No persistent replay store, durable key rotation and revocation, issuer deployment, authenticated transport, hardware-backed trust boundary, or real provider receipts. `consumedJti` is an in-memory set in the review fixture.
- Any production design must separately authenticate Google-issued service identities, bind session/generation audit records to durable Firestore epochs, validate provider responses through independent storage controls, and sign internally derived evidence only after those checks.
- A compromised or incorrectly authorized signer can still sign false provider claims. Do not treat a signature from a configured key as GCS certification.
- The preceding R1732 fail-closed worker denial remains in draft; no positive private render is enabled.

## Release gates
Provider canary evidence: exclusive broker IAM, alternate and stale writer provider-side denial, resumable session termination/cancelled/finished race proof, generation-bound cleanup and readback absence, independent security/privacy approvals, protected green CI and exact-source staging. Credentials incident #370 remains unresolved.

**PRODUCTION HOLD / NO-GO; PRIVATE MEMORY WRITES OFF.**

