# ONE URAI GENESIS — R955 cross-service revocation lineage and continuation-policy reconciliation

**Date:** 2026-11-09 UTC. **Disposition: PRODUCTION HOLD / NO-GO.**
**Scope:** source-pinned comparison of Jobs post-admission data-rights execution, Privacy canonical consent-revocation/outbox review chain, and the open privileged Storage revocation gate. Read-only GitHub source/PR evidence plus documentation-only handoff. No cloud/provider access, IAM mutation, production data, media, paid compute, merge or deployment.

## 1. Why this checkpoint exists

Jobs R900 (#377) reproduced that a data-rights export/delete admitted under an operator's current authority can continue its asynchronous effect after that operator is downgraded, disabled, or otherwise loses authority. Jobs R898 (#373) rechecks the operator inside the initial admission transaction, but the transaction commits before export upload or Jobs-scope deletion. The remaining question is not safely answered by a blanket abort: approved user deletion may need to continue under a durable centrally approved service identity even if the initiating operator is removed.

Separately, Privacy's current review chain R17–R20 is adding stored-subject binding, original grant lineage, and replay/collision refusal for consent revocation outbox events. That work is directly relevant to the authorization proof a durable continuation policy would need, but it is not a completed cross-service write fence or purge acknowledgment.

## 2. Jobs source and behavioral evidence

- Jobs main remains 9d29be1bcd3a45a4b9a743df9c9706c00811f38b.
- Jobs R898 review #373 da0f242ccf35e5e718a3a6c36d5a3009651ecdd6 adds current operator verification within the initial request admission transaction.
- Jobs R900 review #377 f8578ea281e818b01811aecc2fe4dfb8c3dc8203 executes the full original TypeScript data-rights executor with synthetic in-memory Auth/Firestore/Functions/GCS. The recorded diagnostic suite is 12/12 PASS because it reproduces the current behavior. Four cases confirm continuation after post-commit operator role downgrade, disablement, central deletion fence or Jobs-scope DELETE. The strict counterfactual safety suite intentionally remains 12 PASS / 4 FAIL, exit 1, log SHA256 7e70ae305cc1f790a29aa8e7971bf42c9b09503ae7ce3e339f40239f34d65e9b. This is an expected-red policy diagnostic, not an accepted release test.
- Jobs issue #376 remains OPEN. It expressly requires Privacy/legal policy to decide between a durable centrally authorized continuation and revocation-triggered cancellation/reconciliation. No role-withdrawal behavior should be changed until that decision is approved.
- The current R923/R951/R952 Jobs source branches do not close this asynchronous policy boundary merely by fixing callable admission or worker bearer auth.

## 3. Privacy R17–R20 source lineage

| Review | Immutable head / evidence | What it adds | What remains |
|---|---|---|---|
| Privacy #253 R17 | 90a4e581e8494f52d85eab3c576d02b926e7d0d9; evaluator blob 48d277a368a3f9fe9fdb0dafd2a3f6a11b54a2fc | Requires supplied subject UID to match the stored grant UID before ALLOWED | Full Functions, emulator, callable and deployed verification |
| Privacy #254 R18 | dbc193763dc112210c20b5b680e8eb08fdf8396c; helper blob 2a98f71cc5a9d9b1e0a3b038b7c0787d4cfccbcc | Revokes the original grant when owner/purpose/tier/policy identity is replaced | Asynchronous trigger is not an atomic downstream final-write fence |
| Privacy #255 R19 | a4d7e4ffb76fa2dbbf7348e2b66faa991761509a; helper blob a875baa121eb904b5b7fc96f4d17e914ff8eb544 | Preserves prior granted receipt hash/state separately from the newly written receipt | Receipt hash is not provider signature, full consent chain, or deletion proof |
| Privacy #256 R20 | cfc9de884dc975ca04fa2b80b7bddcf5b9896ff6; helper blob 0ddee615f1284a58459aae48b915a574da7c9c9e | Classifies outbox replay as identical, legacy-missing-lineage, or conflicting; refuses silent success for legacy/colliding evidence | Full project tests, Firestore trigger, migration/disposition channel, consumer acknowledgments, deployed revocation fence |

Independent GitHub source readback in this continuation confirmed Privacy main still has the older helper blob 0b862f27407e34c4123fafccf5d5309af379bc77 and revocation trigger blob d56fdf48010afe163378390154ab42ae7baef660; the corrected R20 helper 0ddee... and trigger 84f1e77d5c1cf55f80aaa0a559b6a3eac781386e exist only in the unmerged R20 review head. These are source-version facts, not evidence of deployed function code.

R20's original patch compares immutable identity and lineage fields, ignores mutable delivery/ACK bookkeeping, and refuses to overwrite or backfill legacy outboxes lacking prior-grant lineage. Its report records 66/66 synthetic pure-helper tests and isolated TypeScript PASS, while full root Vitest, Functions compile, Java21 Firebase emulator, authenticated trigger/transaction, live IAM/Rules, CI and independent review remain NOT RUN.

## 4. The independent Storage P0 remains a separate hard gate

Jobs #252 is OPEN. Its exact safety property is storage-enforced denial of all new/late writes after owner withdrawal, including stale workers, alternate principals and already-admitted uploads; cleanup cannot ACK until in-flight attempts are drained or rendered unable to finalize, exact GCS generations reconciled/deleted, and final absence durably acknowledged.

A Firestore outbox receipt or successful trigger invocation does not prove the GCS writer is blocked. A point-in-time list/delete does not prove there cannot be a future write. Firebase client Storage Rules do not constrain privileged Admin SDK/Cloud Run writer identities. The required real nonproduction effective-IAM 403, upload-drain and generation/ACK acceptance has not been performed.

## 5. Required cross-service design decision before implementation

Privacy/legal/security owners must record a versioned policy for each approved data-rights operation:

1. **Durable continuation path:** bind the originally approved request to central Privacy authority, owner, operation, purpose, exact request UUID, prior-grant receipt lineage, tenant, service identity, revocation epoch, bounded expiry/attempt, allowed side effects and owner-only delivery. Initiating operator removal should not silently erase an already approved owner's rights request; instead, a trusted service authority must be explicitly authorized to finish or safely reconcile it.
2. **Cancellation/reconciliation path:** if the approved policy instead requires cancellation, use a monotonic fence/epoch and storage-enforced write denial, track partial side effects and exact generations, and leave the request in a reconcilable nonterminal state until cleanup is provable. Do not flip the central deletion fence back to false or report success after partial cleanup.
3. **Common invariant:** before each irreversible side effect and before terminal receipt/ACK, verify a current durable execution authorization that is not solely the original operator's stale token. The exact source owner, epoch, operation, target data scope and receipt must agree across Privacy and Jobs. This is a design requirement for review, not a claim that current code already implements it.

No code was altered here because the policy authority and exact lawful continuation behavior are not established by the available evidence.

## 6. Next exact verification sequence

- Obtain signed Privacy/legal/security decision for post-admission operator withdrawal and approved deletion continuation.
- Define source-pinned durable continuation/fence contract; test admission, commit, pre-effect, in-effect, partial failure, retry, finalization, owner-only export, and deletion idempotency with native disposable Firebase emulators.
- Exercise real protected nonproduction GCS IAM stale/alternate writer 403, upload drain, exact generation and durable ACK independently from emulator success.
- Execute the Privacy R20 original test in the complete checkout and full Functions/Firestore trigger path; provide explicit migration/disposition for legacy-missing-lineage outbox events rather than silently accepting or retrying forever.
- Re-run full same-SHA Jobs and Privacy test/build/CI; verify deployed source fingerprints and effective service identities with authorized read-only cloud inventory.
- Only after cross-service evidence, independent approval and founder GO may production HOLD be reconsidered.

## 7. Final classification

**Confirmed source facts:** R900 post-admission continuation behavior is reproduced in synthetic tests; R17–R20 source fixes exist in sequential unmerged Privacy review branches; current Privacy main remains at earlier source; Jobs Storage P0 remains open.

**Not established:** governing policy for post-admission role withdrawal; current deployed Privacy or Jobs source; actual provider authorization, GCS future-write denial, purge ACK, full authenticated C6 lifecycle, or production safety.

**NO MERGE / NO DEPLOY / NO PRIVATE MEDIA / NO IAM CHANGE. ONE URAI GENESIS — PRODUCTION HOLD.**
