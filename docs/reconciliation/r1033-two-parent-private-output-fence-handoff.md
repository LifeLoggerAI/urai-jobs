# ONE URAI R1033 — two-parent conservative revocation convergence (HOLD)

## Custody
- Parent 1: Jobs #416 R1028 tamper guard at a55cb0ff5d4b3054c3c0858160516024ea5acfea, source tree 879f5cc5ecb7b72aa4dea493165114f5002907c5.
- Parent 2: Jobs #415 R1031 first-event historical lineage uncertainty at 927e7587d813b0f2c615d5a24d0ec318ee970e9b.
- Shared ancestor: Jobs #414 at cf8d10d5a318063189ac5939a5c9febf48e19404; Jobs #413 preserves R1026 worker donors.
- This commit preserves BOTH Git ancestries (not a squash) and changes only the revocation transition, its focused tests, the exact source-blob pin, and this handoff.

## Source behavior
- Every first revocation fence marks legacyLineageUnverified:true. Absent Jobs consent block is NOT proof of GCS inventory, absent historic objects or drained uploads.
- Retains R1028 persisted-schema, privilege alias, accessor/prototype guard, exact replay, monotonic epochs and literal false storage authorization/deletion flags.
- Combined helper source Git blob: cae39b3e5acaf03e9b6b0c4aaa15f1907f17cfdd
- R1028 standalone 18/18 focused PASS and full native verify PASS on #416. R1031 standalone 13/13 focused PASS and full native verify PASS on #415. Neither is a test result for this combined commit.

## Release HOLD
- Jobs #252 unresolved: no provider-enforced IAM writer exclusion, sole authenticated upload broker, durable pre-byte reservation, alternate-identity 403, active upload drain, generation-bound deletion, replay authorization or deletion ACK.
- Do not enable private writes, merge, bypass protected CI, change IAM or deploy. Require independent exact-commit tests and staging provider security proofs.
- Other workers and Runpod R950 / R1032 preserved.
