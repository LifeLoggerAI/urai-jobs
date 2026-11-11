# ONE URAI Genesis — R1057 owner/purpose scope review model (HOLD)

**Exact tested source:** Git branch `review/chalk-r1057-owner-purpose-revocation-no-ack-20261110` based on Jobs #437 `65c746bdc8f1c39db417ce7cf978e1e29b8aac16`. Two newly added review-only files only; original Jobs worker, Firebase functions, package scripts, hard-off private Storage writer and donor PR branches unchanged.

## Exact immutable blobs and reproducible execution

- Existing source dependency `scripts/review-only/life-movie-writer-fence-model.mjs`: Git blob `6526c5f5b1bfe1ddcd8bd50204e9639ea7f71e05`
- New model `scripts/review-only/r1057-owner-purpose-drain-model.mjs`: Git blob `b1e15448896deea6b982e909843e3751918d689e`
- New tests `scripts/review-only/r1057-owner-purpose-drain-model.test.mjs`: Git blob `cc6a99a90e864809908bd55cf6fa8105fad32429`
- All three GitHub blob identities checked against local `git hash-object`, exact match.
- `node --test scripts/review-only/r1057-owner-purpose-drain-model.test.mjs` from clean checkout; actual isolated Node v22.16.0 run against identical file contents: **17 tests PASS / 0 FAIL / exit 0**.
- Local final TAP log SHA-256 `826cc2b278a6dca73d2ee3f2384f76f7e306c8352ff8b3b15d89028e49128175`; available in founder's R1057 ChatGPT conversation, not yet a GitHub artifact.

## Scope and fail-closed results

This module wraps the pre-existing R521/R573 pure review snapshot transition model to add a canonical **owner/purpose** withdrawal model across independently registered tenant/project scopes. It detects withdrawal before first registered scope, fences later registrations, checks cross-project late bytes and unresolved attempts, refuses duplicate attempt IDs, denies conflicting revocation events and malformed identities, and isolates other owners. All returned snapshots are copies. `summary().deletionAcknowledgementPermitted`, `summary().productionAuthorized`, `summary().storageWriteFenceVerified`, and `summary().storageInventoryVerified` are unconditionally false; `acknowledge()` always throws, including when all synthetic attempts settle. There is no production integration or grant.

**Known limitation:** State and withdrawal event are in local process memory, not durable or authoritative. Test fixtures can claim synthetic evidence, are NOT trusted attestations or physical Storage inventory. The model does not block direct GCS writes, prove post-revocation HTTP 403, implement IAM, transactionally coordinate concurrent workers, persist across crashes, drain network streams, enumerate every approved bucket, or authorize deletion. These are still P0 requirements under Jobs #252. Never connect the model to the running worker or let it trigger Replay, owner consent or Storage permissions.

## Release controls

1. Run the real Jobs frozen native/full tests and actual four-Firebase-emulator integration with Privacy pinned to this new source, without transferring old HEAD passes.
2. Restore protected GitHub Actions with actual job steps, exit codes and private immutable log receipts; Labs #248.
3. Contain potentially exposed Runpod credential via owner/provider revocation and audit, Labs #370; no new credential-bearing Pods until verified.
4. Build and independently prove **real exclusive GCS writer IAM**, durable owner/purpose epochs, prebyte reservation, in-flight stream drain and exact object-generation deletion ACK, negative post-revocation writes, multi-bucket/tenant isolation, signed consent→render→Replay→withdrawal, device and accessibility/visual/rollback signoff. Jobs #252 and Labs #247 remain **HOLD**.

**Production NO-GO.** No protected-main merge, worker activation, production Storage/IAM/rules change, user media write or deployment was performed.
