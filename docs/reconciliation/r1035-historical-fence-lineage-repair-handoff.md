# ONE URAI R1035 — monotonic lineage uncertainty on historical revocation (REVIEW/HOLD)

Source parent: Jobs #419 exact 8cacd11fe575bee8c85e2c85886063a143e49244. This keeps its two real parents Jobs #415/#416 and all prior ancestry. Peer #417/#418 remain distinct, not deleted or marked redundant.
R1034 native Runpod PASS is evidence for the parent only; this candidate needs fresh exact-source tests.

## Security correction
Existing persisted `legacyLineageUnverified:false` may have been written by earlier review code without a GCS/provider inventory or writer drain. Never interpret it as verified absence.
- Exact matching replay already verifies canonical receipt and active block; a Firestore transaction now updates only `legacyLineageUnverified:true` and updatedAt (new `repair` transition), without changing event ID, epoch, permissions or any deletion ACK field.
- Valid newer event always writes `legacyLineageUnverified:true`, even when the old state was false; other strict R1028 persisted validation and authority checks remain.
- Original private-output writes remain hard-off. No trusted broker or IAM policy is activated.
- Provenance harness pins immutable current helper and handler Git blobs to prevent fixture bypass.

## Unclosed release gates
Jobs #252: real Storage-enforced exclusive write broker, pre-byte reservations, revoke/drain, alternate identity denial and exact generation-based deletion. Positive consent-to-Story/Studio/Jobs/Replay and production protected CI/reviewer are outstanding.
Historical false fences receive only non-authorizing conservative repair on exactly matched revocation receipt/block or newer valid event. No automatic physical deletion acknowledgement.
Do not merge, deploy or enable GCS writes from this draft. Independent Runpod suite and protected review required.
