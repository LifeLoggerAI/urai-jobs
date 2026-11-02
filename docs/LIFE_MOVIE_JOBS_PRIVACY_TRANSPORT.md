# Jobs → Privacy Life Movie transport — draft, fail-closed

This change adds a **source-only** Firebase callable client in
`functions/src/privacy/lifeMovieConsentTransport.ts`. It is not a grant issuer,
production transport deployment, authenticated runtime test, or render switch.

The client builds the exact Privacy callable URL from a separately approved
Firebase project and region; rejects an unpinned Jobs UID; rejects tokens with
obviously mismatched Firebase Auth claims; requests
`verifyLifeMovieRenderConsent` using Firebase's `{"data": ...}` protocol;
rejects network errors, redirects, non-200 status, malformed or oversized
responses; and passes the returned `result` to
`assertLifeMovieConsentDecision`. A decision is re-evaluated on each call and
is never cached or treated as authorization for the entire job lifecycle.

**No credential issuer has been provisioned by this commit.** The caller must
supply `getDedicatedJobsFirebaseIdToken` from a trusted Jobs server-side
identity integration; never supply a user token, Studio bridge token, inbound
Authorization header, or caller-controlled credential. Parsing JWT claims in
Jobs is an early mismatch check, **not** signature verification. The Privacy
callable must authenticate the ID token and recheck its pinned UID, verified
system claims and Firebase custom sign-in provider. Approval of the signer,
Firebase project, IAM and protected invocation remains outstanding.

`lifeMovieConsentAuthorityAvailable()` remains hard-coded false. In particular,
this client is **not yet called** by live job creation, queue leasing, worker
processing, assembly, playback or download. There is still no trusted scoped
grant issuer, independently checked tenant membership / selected-source rights,
or independently accepted hosted consent lifecycle. Existing 503 behavior is
preserved; do not activate a render path based on this file or a green synthetic
transport test.

## Next reviewed integration

1. Independently review the exact Firebase Auth project, approved Jobs service
   identity, signer and token exchange; provide a server-only token supplier.
2. Implement verified scoped user grant issuance with independent source-rights
   and tenant checks; pin the canonical immutable source selection contract.
3. Wire **fresh** service decisions to create, queue lease, dispatch, resume,
   render, assembly, playback and download, including cancellation/deletion
   races and expiring links. Keep the hard gate closed until then.
4. Run exact-committed-source native TypeScript and Firestore emulator tests,
   followed by protected hosted positive and negative tests and non-author review.

No paid resources, IAM changes, deployed callable, Rules changes, grants, jobs,
media delivery, production release or public publishing are authorized here.