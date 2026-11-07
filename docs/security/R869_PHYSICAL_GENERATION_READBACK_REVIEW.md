# R869 — storage-backed physical generation observation (review-only; HOLD)

**Parent:** Jobs R866 draft #329 source `1065851a11af2e3b2bf362fc1ac880944a2bf4e4`, which retains R857's 6/6 executed emulator proof and the independent staging IAM negative-data-plane probe. **This is a separate review branch; PR #329 and its operator evidence are untouched.**

## Finding

R857 `recordReviewOnlyBrokerPhysicalGeneration(identity, generation)` accepted a caller-provided decimal string, then transactionally saved it to Firestore without reading the actual Storage object. An untrusted caller to this review-only function could claim a nonexistent or wrong generation at the canonical object location; the durable ledger would then look populated without physical evidence. R857's green tests used a genuine generation supplied by their fixture, so the attack was not covered by those existing tests.

## R869 repair

- Keep the review-only local Firebase emulators, ownership scope validation, and no production grant.
- Before writing any physical-generation record, look up the exact deterministic `tenants/{tenant}/life-movies/{project}/review-only-broker/{digest}.bin` object in disposable bucket `urai-staging-test.appspot.com`, via the emulator Admin SDK. Require its observed canonical generation to equal the claimed value. 404, failed metadata reads, mismatch, unsafe JavaScript number or invalid decimal reject without creating a false physical generation record.
- Treat generation as a canonical positive unsigned **64-bit decimal string**. Do not convert to `Number` for comparisons, which would silently truncate values beyond `2^53-1`. Check range using `BigInt`.
- The original Firestore transaction still rejects incompatible fence epochs and preserves recorded physical generations as unresolved after consent withdrawal. No production GCS access, IAM rights or Studio worker write toggle has been added.
- Original Firebase test now covers missing object and forged/stale generation, record remaining `SIMULATED_IN_FLIGHT`, malformed/overflow decimal and the prior R857 success/late-write checks.

**Important limitation:** Storage metadata readback precedes (and is not atomic with) Firestore transaction. A replacement/delete may occur between those operations. This is a stronger *observed-generation* ledger, not durable exclusive upload authority, physical output deletion ACK, IAM certification or permission revocation. Existing recorded observation is not itself finalization approval.

## Native acceptance still required

The new R869 GitHub source/branch can be read back, but **do not inherit earlier R857/R866 native PASS certificates onto this modified SHA**. Run on a clean detached R869 head with Node22, pnpm8.15.9, Java21, no live cloud credentials, a frozen install and Functions build, and the original `firebase-tools@15.24.0` disposable Firestore/Storage emulators with `URAI_EMULATOR_PROJECT=urai-staging-test`. Require actual `R857_REVIEW_ONLY_PHYSICAL_GENERATION_LEDGER_PASS` (now **7** checks), zero exit, clean worktree and SHA256 log digest. Also rerun the unchanged R854 negative runner and original workspace verify/typecheck/build at R869 SHA before an integrated PASS claim. No native R869 execution has been confirmed by this branch at creation.

**Remaining P0 #252:** effective real GCS old/alternate writer 403, exclusive scoped identity, durable in-flight transfer termination and all-generation cleanup, genuine signed owner/source-rights consent, protected Replay, protected CI and independent release approval. All continue **HOLD**.
