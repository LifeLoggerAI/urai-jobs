# ONE URAI Genesis — R1062 two-parent security review convergence (NO-GO)

This review-only merge preserves **both** independently authored R1061 workstreams without changing the protected branch.

- **Parent 1:** Jobs PR #444 `228e6ddf5a3a94f118e0b96b1faa353929f57ef4`, tree `76e9abf6b469c80b1d457429ffa5c70b8e3e553f`. Removes both direct `file.createWriteStream` private output operations from Studio worker and funnels upload intents to a new **unconditionally denying** broker stub; worker's pre-existing write interlock remains unconditional hard-off. Includes independent broker/static tests. This does **not** implement real GCS IAM/writer.
- **Parent 2:** Jobs PR #445 `20617be61a7e6e03bb85a37757a0fc9f75544fc7`, tree `8287748d06156683084c8a1d9094eeaf8ad1e93c`. Adds atomic review-only canonical owner revocation and active/malformed consent-block checks **before creating a first project OPEN scope**; original Firebase emulator fixtures and source tests updated. No production private writer activation.
- The two donor changed-file sets do not overlap. Base exact #444 tree plus four exact blob entries from #445 and this custody document; original donor PRs remain untouched.
- R1061 #445 narrow connected-source assertions **10/10 PASS** on exact branch SHA; these are *static* readback invariants, not native tests. Jobs #444's new original source tests still require independent execution. Neither donor is production release approved.
- The existing R1060 independently tested Jobs #443 + Privacy #275 negative four-Firebase-emulator pair is an **older exact revision** and cannot be promoted as this merge's run receipt. The combined commit requires frozen full Jobs and exact Privacy-native verification with immutable logs. Treat any missing native run as **NOT RUN**, not PASS.

## Mandatory P0 and release controls
1. Preserve the worker hard-off and broker stub fail-closed. Never enable writes until a separately reviewed *real* sole trusted Storage writer with exclusive service IAM, stale/alternate identity provider-level 403, durable epochs/reservations, active stream draining, exact generation deletion and no-write after ACK passes staging/cloud data-plane probes.
2. Labs #370 exposed Runpod API key is not provider-revoked/rotated on recorded evidence; no credential-bearing testing.
3. Labs #248 Actions runner startup failures and independent protected approval still outstanding.
4. Complete positive signed consent -> Privacy -> Studio -> Jobs -> protected Replay -> withdrawal/deletion, devices and accessibility/AAA visuals, rollback, founder GO.

**ONE URAI Genesis global production: HOLD.** No main merge, production IAM/Rules edits, private media write enablement, grants, customer media or deploy authorized by this document.
