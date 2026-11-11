# ONE URAI Genesis — R1061 review-only first-scope canonical revocation guard (HOLD)

## What changed
Exact base: Jobs #443 `bbe3ef6f8807a42c0a402ade8a5d5ebd43f4c0aa`. This review branch makes **no changes to the Studio production private-output worker, IAM, Storage Rules, deployment, consent grants, or private data**.

Pre-existing emulator-only `seedReviewOnlyOutputScope()` created a per-project `OPEN` Firestore review fence even when a *canonical owner/purpose-wide* withdrawal fence already existed. Later reservation and pre-byte guards denied the write, so **this is not evidence of an unauthorized render or GCS write**. Nevertheless, the persisted OPEN state was misleading and could undermine future assumptions.

R1061 fixes this review-only fixture: inside the *same Firestore transaction as per-project fence creation*, read canonical owner/purpose withdrawal and the owner/purpose job consent block. Any existing canonical fence (including malformed data) vetoes scope creation. An active or malformed consent block also vetoes. Only a missing canonical fence and an absent or explicitly inactive block permit creation of the strictly non-authorizing review scope. The revision refuses to turn revoked scopes back OPEN or issue ACK.

## New adversarial coverage
- Existing same-owner cross-tenant fixture now requires the new project-scope seed to be denied after canonical withdrawal; no intermediate OPEN scope is inserted.
- Added native 4-Firebase-emulator fixture for withdrawal **before first project scope**: scope seed refused, Firestore review fence absent.
- Added native fixture for active and malformed consent-block records **before first scope seed**: seed refused, review fence absent.
- Updated R1042 original-source static regression to enforce all three reads occur transactionally before creating a fence, retaining original three admission canonical reads, and verifying the worker write hard-off.
- Original Jobs #443 runtime/worker hard-off SHA remains `ea6b25f3949ec2c17f65a9da68fa9cf937e86e76`.

## Evidence boundaries
GitHub exact blob readbacks:
- `functions/src/privacy/lifeMovieWriteReservationsReview.ts`: `9c3cf9be4f42641fb364bb2020cbeff609900314`
- `scripts/life-movies-write-reservations.review-emulator.mjs`: `b0deb6f4316d064b7c1da7845fbb6b11ada28a7c`
- `scripts/r1042-canonical-revocation-veto-wiring.test.mjs`: `031c60ab6cbee14dfa4d5a826b2e3bc615fe74e0`

Independent source readback assertions: **10/10 PASS** (transactional read ordering, canonical/consent veto, no positive grant, regression enrollment, existing hard-off). The first structural assertion was corrected after matching the actual Firestore `transaction.create(fence, {...})` call. **These are targeted source-level checks only.** The new R1061 original Node static suite, actual disposable Firebase emulator runtime, frozen install, Jobs full build/verify, Privacy native cross-service and protected CI **have NOT been executed on the new commit**. Local container cannot resolve github.com to clone; do not transfer peer R1060 Jobs #443+Privacy #275 0-exit native evidence to R1061.

## Existing accepted R1060 receipts (older exact revisions)
Runpod workers recorded actual negative four-Firebase-emulator native Jobs #443 `bbe3ef6f8807a42c0a402ade8a5d5ebd43f4c0aa` + Privacy #275 `325c538ce06ade9fd357ba48ebb0017f4d912366`: native, full Jobs verification, typecheck, build exit 0; see Privacy #275 comment 6787635771 and Jobs #443 comment 6787606967. Full logs remained on disposable storage with terminal hashes and are not protected archived release artifacts. R1061 is a separate review-only change not covered by those receipts.

## Required release work
Jobs #252 exclusive storage-enforced GCS writer, real old/alternate identity 403, durable prebyte owner/purpose fence, active upload drain and generation inventory/deletion, post-ACK future-write denial. Labs #370 exposed Runpod credential remains uncontained without provider-side rotation/revocation receipt. Labs #248 GitHub Actions runner failures with missing job steps. Then independent exact-commit Native + Privacy positive/negative, protected approval, signed owner consent->Studio->Jobs->protected Replay->revoke/delete, device/accessibility/visual, rollback, founder GO.

**Production HOLD/NO-GO**. Review-only transaction hardening, not cloud writer implementation. Preserve all donor PRs. Do not merge to protected main, enable private writes or change IAM from this result.
