# ONE URAI R1042 canonical withdrawal vetos review-only admission — HOLD

Parent Jobs #422 2437d273752768214ab18b9f8dcb58d31cc40ce0; preserves all other workers, PRs, donor branches, hard-off and previous evidence.

Two separate existing systems: the canonical Jobs server-owned owner/purpose withdrawal collection lifeMoviePrivateOutputRevocationFences, and the emulator-only lifeMovieWriteFencesReviewOnly per owner/tenant/project reservation simulator. The latter previously did not inspect canonical withdrawal. R1042 adds same-transaction canonical document reads to reserveReviewOnlyOutputAttempt and beginReviewOnlySimulatedUpload. ANY canonical owner/purpose document, even malformed, blocks admission; missing document is NOT positive consent.

New disposable native Firestore emulator tests cover pending reservation, pre-byte transition, malformed record, owner-wide scope crossing tenant/project, unrelated owner isolation, all grants and deletion acknowledgments false. Static source guard enrolled in full Jobs verify.

This is emulator/review-only. No live GCS data-plane denial or exclusive IAM broker, no upload stream drain, no signed positive consent, no physical generation deletion, no private playback/ACK, no protected CI/reviewer approval. Original worker private-output write hard-off unchanged. Jobs #252 P0 and Genesis PRODUCTION HOLD.
