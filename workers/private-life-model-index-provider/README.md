# Private Life Model Index Provider

This service implements the previously missing provider behind `PRIVATE_SOURCE_INDEX_URL`.

It accepts only the already-authorized opaque source handle and private transcript/provenance refs emitted by the governed private-source worker. It then:

1. resolves private refs through a separate authenticated resolver;
2. verifies source fixity and non-synthetic historical authority;
3. performs bounded evidence extraction into `urai-life-model-v1`;
4. preserves uncertainty, contradictions, negative constraints and SceneTruth state;
5. reserves an input-bound, fenced Firestore attempt before extraction and writes immutable revisions;
6. returns only opaque private refs, hashes and release metadata.

The service deliberately fails closed when resolver, extractor, Firebase or exact-source bindings are absent. Raw transcripts are never returned and are not intentionally written to application logs.

## Required protected environment

- `PRIVATE_SOURCE_INDEX_TOKEN`
- `PRIVATE_SOURCE_REF_RESOLVER_URL`
- `PRIVATE_SOURCE_REF_RESOLVER_TOKEN`
- `OPENAI_API_KEY`
- `URAI_LIFE_MODEL_EXTRACTOR_MODEL` (required, explicit protected model binding)
- `FIREBASE_PROJECT_ID` or `GOOGLE_CLOUD_PROJECT`
- `URAI_SOURCE_SHA`

No provider activation, private-data processing or production deployment is implied by source presence alone.

## Retry and evidence admission

Authorized retries reuse the existing revision without invoking the extractor again. A key is bound to the source fixity, transcript bytes, evidence class, opaque refs, locale, prior-index ref and correlation trigger. Reusing it for changed input returns HTTP 409. Historical idempotency records without an input binding fail closed; prepare a fresh governed job key after validating their retained source history.

Concurrent identical submissions return HTTP 503 with `Retry-After: 5` while one 180-second lease owns extraction. Expired or failed attempts can recover up to three attempts; stale attempts cannot commit a revision. The extractor has a hard 8,192 completion-token limit. Current resolver authorization is checked before reservation, again before commit and before delivery, including replay. The resolver must enforce current source consent/revocation each time.

Graph admission validates unique IDs, declared entity/claim references, bounded source spans, evidence classes, confidence, date intervals, place precision and bounded attribute structure. Unresolved contradictions produce `BLOCKED` SceneTruth. These checks do not prove that a model interpreted testimony correctly. Human/private-source comparison remains required.

Run `npm run life-model:index-provider:verify` to execute source checks and actual HTTP-handler contracts with injected resolver/extractor responses and serialized Firestore transactions. These tests never contact providers or process private source media. Native emulator, authorized resolver, paid model, cross-source correlation, export/deletion and runtime admission proofs remain separate acceptance requirements.

The extractor omits sampling overrides for reasoning-model compatibility. OpenAI's parameter compatibility documentation lists `gpt-5-mini` among models that reject these fields: https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.2#parameter-compatibility
