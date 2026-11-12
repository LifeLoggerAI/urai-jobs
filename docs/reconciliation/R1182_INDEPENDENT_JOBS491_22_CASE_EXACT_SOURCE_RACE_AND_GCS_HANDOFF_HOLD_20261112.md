# ONE URAI Genesis — R1182 independent Jobs #491 source-locked security reproduction (HOLD)

Date: 2026-11-12, US Central. Scope: **review-only**, no live GCS access, no credentials, no private data, no IAM or production change.

## Exact source lock

Source Git commit: `39f469254dc3e8e998f6a2ee8e5b1f2f6498dc28` (Jobs draft [#491](https://github.com/LifeLoggerAI/urai-jobs/pull/491)), two-parent source #489/#490.

These four files were read from the above exact commit through authenticated GitHub file access. I reconstructed them in a clean disposable local directory and compared `git hash-object` values to the original GitHub blob SHA-1s. All four matched EXACTLY:

| File | Git blob SHA-1 |
| --- | --- |
| `scripts/review-only/r1141-drain-race-model.mjs` | `c2346d0e735e96e783f25251e7aa575510157ace` |
| `scripts/review-only/r1141-drain-race-model.test.mjs` | `89961188b697e078ad8c984d7893eebb787d0b15` |
| `workers/storage-broker/r1167-synthetic-gcs-bridge.js` | `902d3eb7d7ee598c3f54f33b1ede03363603468a` |
| `scripts/review-only/r1167-synthetic-gcs-bridge.test.mjs` | `ec1f4baa1edfe215378f331a015cfb10d2fa3fbd` |

Runtime: local Node.js v22.16.0, no package installation; no external network calls. Original tests unmodified.

Command:
```sh
node --test scripts/review-only/r1141-drain-race-model.test.mjs scripts/review-only/r1167-synthetic-gcs-bridge.test.mjs
```

Result: **22 tests / 22 PASS / 0 FAIL / 0 skipped / exit code 0**. Combined original TAP stdout/stderr file SHA-256 `830be615af51ee3496a1978fb956ef3b2f391fae88277e8f63d901d9e253fe21`. This is a **local file digest**, not a retained provider-signed or eligible independent release approval.

Bounded synthetic race enumeration:
- `R1141_BOUNDED_INTERLEAVINGS=40320`
- `ELIGIBLE=5408`
- `PREMATURE_DENIED=34912`
- `SYNTHETIC_ONLY`

The source and tests correctly document that an old point-in-time inventory permits a late-write counterexample. The fake GCS bridge does **not** grant a private write or deletion ACK; its successful canary result remains `SOFT_DELETE_UNVERIFIED`.

## Scope limits and P0 work

These results **do not** prove live GCS writer exclusivity, resumable upload cancellation, provider audit identity, generation-bound deletion under real IAM, owner-positive C6, or a launchable product. Tests run against an injected fake GCS client and local synthetic models. No full Jobs installation/build/verify, actual hosted staging, protected GitHub CI, or independently appointed security review is asserted here.

**P0 Jobs [#252](https://github.com/LifeLoggerAI/urai-jobs/issues/252):** provider-enforced sole broker identity and deny of retired/alternate writers; epoch-authorized durable reservations before first byte; enumerate/invalidate every pre-revocation resumable upload capability; generation-specific cleanup; exact provider IAM/log/orphan evidence and signed review. Stopping workers or removing direct IAM alone does not prove a previously issued resumable upload session cannot finalize.

**P0 Labs [#370](https://github.com/LifeLoggerAI/urai-labs-llc/issues/370):** exposed Runpod credential's actual provider-side revocation and incident closure by account owner/security admin, sanitized audit receipt, not a key value.

**Other:** authenticated consent → Studio → Jobs → Replay → withdrawal/deletion positive and negative scenario; restore protected CI case #4889576; independent security/product/privacy review and 19-repository device/accessibility/locale/store/rollback and source-pinned preview acceptance.

## Worker handoff

1. Confirm #491 exact source SHA and compare all four blobs. Retest the original maintained Jobs full verifier on protected runner (separate from these narrow offline suites) with frozen dependencies.
2. For GCS provider certification, use a separately authorized keyless identity on a disposable canary bucket and a restricted reviewer. Record exact signed identity, effective policy, denied retired/alternate writes, cancellation/replay status, specific object generations and cleanup. Do not write real owner data.
3. Coordinate with Labs #448 and Privacy #298 owner branches; preserve their exact source lines, no blind main merge.
4. Keep private writes disabled and production HOLD until **all** independent gates pass. No synthetic receipt may be promoted into provider approval.

**Final decision: HOLD_NO_GO. PRIVATE MEMORY WRITES DISABLED. No main merge, IAM change or production deployment.**
