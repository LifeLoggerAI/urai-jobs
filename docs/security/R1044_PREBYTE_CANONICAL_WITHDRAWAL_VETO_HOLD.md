# R1044 — canonical owner withdrawal at final simulated pre-byte veto (REVIEW / HOLD)

Parent Jobs #423 exact b66f56e81fcc9286bae5421900c8139dd356a849, descended from #422/#420 and the two-parent #419 lineage. Sibling agents' branches, test receipts and the original worker write hard-off are unchanged.

Source review found a third simulator path, `assertReviewOnlyBrokerPreByte`, which still checked only the per-project review fence and attempt. A canonical owner/purpose withdrawal arriving **after** simulated reservation and upload-start could be missed while the review fence remained OPEN.

R1044 adds the canonical `lifeMoviePrivateOutputRevocationFences` read in that same Firestore transaction, applying the identical veto used for reservation and upload-start; any existing canonical record (including malformed) denies. The new native emulator case exercises reserve -> simulated begin -> canonical withdrawal -> pre-byte deny, preserving unresolved attempt and false delete ACK. Static tripwire now requires all three stages.

**No real GCS request or IAM policy is changed.** Firestore checks cannot prevent privileged upload finalization between read and GCS write; this remains a review-only negative safety model. The original Studio worker private writes remain hard-disabled. Independent exact-head verification remains pending. P0 #252, full authenticated Replay, protected CI/review, devices, visual and rollback remain HOLD.
