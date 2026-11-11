# ONE URAI Genesis R1061 — remove direct private GCS upload paths (HOLD)

Parent: verified Jobs #443 `bbe3ef6f8807a42c0a402ade8a5d5ebd43f4c0aa`; original three-parent history (#442/#441/#440) retained and all donor PRs untouched.

## Security change
Both Studio worker output uploader helpers previously performed `bucket.file(destination).createWriteStream` directly, after the intentionally hard-disabled `assertPrivateOutputWriteAuthority()`. An accidental future change to that sole boolean could have bypassed P0 Jobs #252 real revocation policy, IAM exclusive principal, in-flight drain and exact-generation ACK.

This review branch **removes both direct GCS output mutation calls entirely** from render and assembly helpers, routing their output intents instead to `private-output-broker-boundary.js`. That new module has *no Storage client, credentials, environment flag or success branch*, and always rejects `life_movie_exclusive_storage_broker_unavailable`. The original first hard-off remains unmodified and still executes before broker request. No private output is activated. Cloud Storage source reads and generation-aware cleanup code remain unchanged. Existing checksum/generation response contract is retained for future independently reviewed broker implementation.

Test changes in `scripts/life-movies-private-output-write-authority.test.mjs` replace obsolete "two guarded direct GCS writers" expectation with "zero direct GCS output writers, two broker calls, original hard-off before every broker call" and check the unconditional broker rejection under attempted environment bypass. The configured full Jobs verification already executes this test.

## Explicit limits
This is a **defense-in-depth architectural fail-closed step**, NOT a functioning authenticated broker, IAM proof, usable private rendering or launch GO. The broker must be separately implemented under an isolated identity with positively established Storage IAM, durable canonical owner/purpose revocation, controlled credentials, active stream fencing/drain, authorized generations, signed positive C6 consent and independent negative data-plane tests. Provider GCS remains unmodified. Old source (including direct uploader) is preserved in original Git history for audit; never promote those donor revisions.

Independent exact-commit frozen Jobs/full/emulator tests must run **before claiming R1061 PASS**. Privacy #275 native negative admission is verified only against older Jobs #443; any runtime changes require a new exact-pair test. Labs #370 incident reported potentially exposed Runpod API key with provider revoke/rotation unverified; do not handle real keys. Labs #248 protected CI failures, Jobs #252 GCS, device/accessibility/cinematic/rollback and founder release authorization gates remain HOLD.

No mainline merge, production IAM/hosting action, private memory write, deletion ACK or user media action performed. One UrAi Genesis production HOLD.
