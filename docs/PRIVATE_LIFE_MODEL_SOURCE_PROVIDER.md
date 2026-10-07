# Protected private-source and Life Model preparation

This source prepares real owner-bound audio resolution, diarized transcription and extraction. It is disabled by default. Local tests use synthetic control doubles and establish no private-source, voice identity, CUDA, device, independent-review or release acceptance.

The existing `private-life-model-index-provider` workspace exposes four authenticated routes:

| Route | Required bearer secret | Operation |
| --- | --- | --- |
| `/authorize` | `PRIVATE_SOURCE_AUTHORITY_TOKEN` | Re-read the current canonical job, owner, lease, consent and protected source grant. |
| `/resolve-life-model-inputs` | `PRIVATE_SOURCE_REF_RESOLVER_TOKEN` | Return retained private transcript/provenance bytes with their verified hashes and exact source/current-correction binding. |
| `/transcribe` | `PRIVATE_SOURCE_TRANSCRIBE_TOKEN` | Redeem a private GCS object at its exact generation, hash its bytes, run bounded diarized ASR, and persist an owner-bound unreviewed transcript. |
| `/` | `PRIVATE_SOURCE_INDEX_TOKEN` | Extract quarantined hypotheses and an inert canonical owner-review import plan. |

`PRIVATE_SOURCE_AUTHORITY_URL` and `PRIVATE_SOURCE_REF_RESOLVER_URL` name the protected service origin. `PRIVATE_SOURCE_TRANSCRIBE_URL` names its `/transcribe` route. `PRIVATE_SOURCE_INDEX_URL` names its `/` route. The worker's execution route and protected provider routes enforce 60 requests per minute per transport IP using IPv6 subnet normalization, before authorization/provider work. Counters are local to an instance; the protected ingress operator must additionally prove aggregate scaling limits and proxy identity. The application does not trust caller Forwarded/X-Forwarded-For headers. HTTPS, separately scoped secrets, exact deployed Jobs source SHA and runtime revision are required. A deployment operator must supply the real ADC principal and prove Firestore/Storage IAM; the service never creates a source grant or infers source ownership from a handle.

## Versioned protected authority

Every worker request carries trusted `ownerUid`, `jobId`, `leaseToken`, opaque `sourceReceiptRef`, purpose and `idempotencyKey == jobId`. These fields come from the authenticated dispatcher and are checked against the stored `RUNNING` job. Private-source creation requires canonical `memory.storage` consent. Source/resolver responses must use `urai-private-source-receipt-v2`, echo owner/job/receipt/purpose/idempotency, bind the lease hash, and prove current consent and correction. Missing fields, a different owner/purpose/source, or a declaration without the canonical protected records is denied.

The privileged source authority must provision `uraiPrivateSourceReceipts/{sha256(sourceReceiptRef)}` using its authenticated server identity, with:

- `schemaVersion: urai-private-source-receipt-v2`, exact `ownerUid`, `sourceReceiptRef`, opaque `sourceHandle`, `status: ACTIVE`, `synthetic: false` and governed `sourceEvidenceClass`.
- Explicit `purposes`, exact consent `purpose/policyVersion/decisionReceiptId`, integer positive `sourceRevision`, private `sourceFixityRef`, source SHA-256 and byte length.
- For audio only, `storage.bucket/object/generation/contentType/durationSeconds`: the bucket must match `PRIVATE_SOURCE_ALLOWED_BUCKET`, object must be under `private-source/{sha256(ownerUid)}/`, and the exact generation must exist. Uniform bucket access and enforced public-access prevention are checked before reading. Original private source storage remains governed by its owning service.

Corrections must update the protected source revision and mark affected transcript records non-current. The index/transcription transactions read those exact documents, so concurrent corrections and revocation force revalidation before a result can commit. The producer's immutable source proof must exist before admission; this service does not fabricate fixity receipts.

Transcripts live in `transcripts/{sha256(transcriptRef)}` below that source receipt. Their contract is `urai-private-source-transcript-v2`: exact owner/receipt/transcript/provenance refs, current source revision/hash, `status: CURRENT`, `synthetic: false`, `requestedPurpose: memory-index`, retained transcript text and byte length/SHA-256, retained canonical provenance and its SHA-256. CURRENT indicates a current machine derivative, never accepted historical facts or identity. An index job must explicitly select those refs.

## Bounded execution and quarantine

Transcription requires `URAI_PRIVATE_SOURCE_TRANSCRIPTION_ENABLED=true`, a real private `URAI_PRIVATE_SOURCE_TRANSCRIPTION_AUTHORITY_REF`, exact source SHA/runtime revision, the admitted private bucket, API key and explicit `URAI_PRIVATE_SOURCE_DIARIZATION_MODEL=gpt-4o-transcribe-diarize`. Otherwise `/private-source-readyz` and execution fail closed. Audio is bounded to 25,000,000 bytes and ten minutes; there are at most 256 segments and 16 anonymous speakers. Metadata generation/size/type and actual downloaded SHA-256 must agree. Inputs stay in memory; the service writes no temporary media files. Its owned input buffer is zeroed on exit. Process isolation and provider retention still require actual runtime/privacy proof.

The fixed Audio Transcriptions API uses `diarized_json` and `chunking_strategy=auto`, according to the [official file transcription guide](https://developers.openai.com/api/docs/guides/speech-to-text). The adapter supplies no known speaker names, voice references, arbitrary prompts or user URLs. It converts provider labels to anonymous `speaker_1` identities, pins segment time and character spans, and records `speakerIdentityAccepted:false`. A five-second current-authority monitor aborts stale work; full execution is capped at 110 seconds. Aborting does not claim that a provider erased data or reversed a charge.

Extraction independently requires `URAI_PRIVATE_LIFE_MODEL_EXECUTION_ENABLED=true`, a real private `URAI_PRIVATE_LIFE_MODEL_EXECUTION_AUTHORITY_REF`, exact source SHA/runtime revision, explicitly configured model and key. Transcript input is bounded to 240,000 characters, extraction to 512 KiB, each collection to 256 entries and the stored record to 900 KiB. Claims must reference known entities and real transcript character spans. Chat Completions requests use JSON output, `max_completion_tokens=10000` and `store=false`, following the [official API reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create). No deterministic or factual acceptance is inferred from model settings.

Both operations durably reserve an owner/input-bound attempt before provider dispatch. Simultaneous attempts cannot spend twice; exact completed replays verify retained bytes and current authority and skip provider dispatch. A failure or ambiguous active attempt requires explicit reconciliation, never automatic paid retraining/transcription/extraction. A corrected source needs a new governed job identity. Consent, correction, lease and deletion are rechecked before storage and again when Jobs finalizes the worker result.

Extracted records are `QUARANTINED_OWNER_REVIEW` or `QUARANTINED_CONFLICTED`, with `historicalSourceAuthority:false` and `reviewState:OWNER_REVIEW_REQUIRED`. The import candidate maps bounded entities and references to Spatial's current entity/claim schema but is inert (`importExecutable:false`). Claims stay UNKNOWN/disputed and `synthetic:true`, so canonical historical ingestion rejects them. SceneTruth stays BLOCKED for owner evidence review. No adapter writes `lifeEntities`, `lifeClaims`, causal graphs, Person/World models or accepted SceneTruth. An authenticated owner must separately review exact source evidence, resolve identities/time/place/conflicts, and use Spatial's canonical governed operations. Source-class labels on a transcript do not accept an extractor's proposed facts.

## Correction, revocation, export and deletion

Owner roots use `sha256(ownerUid + newline + sourceHandle)`; each state, revision and idempotency record carries its owner. Input digests bind owner/job/source revision/fixity, transcript/provenance refs and hashes, purpose, locale and correction trigger. Replays cannot cross those boundaries.

The consent consumer first activates the canonical block, cancels private-source attempts, scrubs job results, marks source grants REVOKED and deletes owned transcript/attempt and extraction subtrees. Data-rights deletion persists a permanent owner tombstone before enumeration and recursively deletes exact owner-bound records. A delayed or unknown pre-admission source cannot resurrect them. Cleanup failures remain retryable and never become successful cleanup acknowledgements.

Protected owner export includes the exact private source and quarantined derivative records. Export requires `GCS_BUCKET_NAME == URAI_JOBS_DATA_RIGHTS_ALLOWED_EXPORT_BUCKET` with uniform access and enforced public-access prevention before upload. It stays hard-off under the existing protected-staging and approved-request contract. Limits fail explicitly; no truncated export is reported complete.

Legacy ownerless extraction records cannot be safely assigned to a user from their handle hash. They require an independently established original owner mapping and operator reconciliation. Original source-media deletion/export and provider retention/erasure are precise external owner/provider boundaries. Responses therefore retain `completeEcosystemExport:false`, `completeEcosystemDeletion:false`, and `completePrivateSourceRevocation:false` until central privacy supplies those acknowledgements.

`node scripts/private-life-model-authority-smoke.mjs` exercises actual handlers and transactions against synthetic Firestore/GCS/provider doubles. It verifies ownership substitution, byte tampering, stale leases, concurrent spending prevention, correction/revoke/delete at provider return, transaction conflicts, private export admission, anonymous diarization and quarantine. `--baseline` reproduces the original ownerless/unchecked resolver and double-spend replay defects at Jobs 16835. Neither mode calls a provider or processes real private media.
