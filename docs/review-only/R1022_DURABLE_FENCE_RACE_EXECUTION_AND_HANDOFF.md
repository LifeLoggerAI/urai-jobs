# ONE URAI R1022 — durable reservation/withdrawal race evidence (REVIEW ONLY)

**Parent:** Jobs #408 at `c0958ea884a686a13a1a99008470b535404b9e80`, preserving R1020 ledger integrity and all earlier donor branches. **No merge, private write enablement, deletion ACK, IAM mutation, deployment or release. Production HOLD.**

## Fresh executed local evidence (Node 22.16.0)
An isolated SQLite WAL / `BEGIN IMMEDIATE` / version-CAS reference was implemented as **two independent uncommitted executables**, packaged with test log and next-worker handoff in the founder chat. This PR documents their behavior and limitations; **the executable sources are not committed into this GitHub branch**, and a future worker must import and verify exact source bytes before merge.

**13/13 PASS** after one captured red-to-green fix: the first 12/13 run exposed a raw SQLite UNIQUE constraint error, repaired to fail-closed `R1022_REVIEW_ONLY_DENIED`. Tests include 16 separate OS processes competing for one reservation (exactly one winner, 15 denied), independent restart persistence, a competing withdrawal-versus-reservation race (only one first-version transaction wins, eventual fencing prevents later admission), old epoch rejection, duplicate attempts, incompatible owner/tenant/project/bucket/purpose/path, idempotent withdrawal and strict NO storage write/NO deletion ACK.

SHA-256 source `4369fa6aba2653e6f0e05cb3df19e55fe4ee8106e7db9e79bb95d69ca2dc074c`; test `fac17a46c40b080628fb7936c8ec14dfed5beb19eff08a7d732eba7c064e79be`; final TAP `b9bfa859872f2c9dae893cc6ebc3fb53cdb4d01713bed52ddaf61828e2d820ac`; ZIP `d31cdcc346bfb06a04d0bddd95f978b599fc7db20fdb14d2c4ce961e5ee80aca`. Reproduction: `node --disable-warning=ExperimentalWarning --test r1022-durable-fence-model.test.mjs` (extracted archive, Node 22).

## Claims deliberately NOT made
Not independent Runpod, not authenticated Firestore, not GCS IAM, not broker authority, not a source-of-truth cloud receipt, not protected CI. Local SQLite and caller-fabricated scope inputs cannot prove cloud storage-level write refusal, stale streaming upload drain, generation-bound deletion or protected delivery. The GitHub doc does not independently attest the unattached local source. **Jobs P0 #252 remains unresolved.**

Next: preserve this work separately from Jobs #408; verify archive source hashes when imported, run independent Runpod pinned executable suite, and progress to real staging Firestore/GCS security negatives after review. Do not bypass GitHub billing/account controls or protected approval gates.
