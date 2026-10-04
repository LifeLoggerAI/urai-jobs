# Private Life Model Index Provider

This service implements the previously missing provider behind `PRIVATE_SOURCE_INDEX_URL`.

It accepts only the already-authorized opaque source handle and private transcript/provenance refs emitted by the governed private-source worker. It then:

1. resolves private refs through a separate authenticated resolver;
2. verifies source fixity and non-synthetic historical authority;
3. performs bounded evidence extraction into `urai-life-model-v1`;
4. preserves uncertainty, contradictions, negative constraints and SceneTruth state;
5. writes immutable Firestore revisions plus an idempotency record;
6. returns only opaque private refs, hashes and release metadata.

The service deliberately fails closed when resolver, extractor, Firebase or exact-source bindings are absent. Raw transcripts are never returned and are not intentionally written to application logs.

## Required protected environment

- `PRIVATE_SOURCE_INDEX_TOKEN`
- `PRIVATE_SOURCE_REF_RESOLVER_URL`
- `PRIVATE_SOURCE_REF_RESOLVER_TOKEN`
- `OPENAI_API_KEY`
- `URAI_LIFE_MODEL_EXTRACTOR_MODEL` (optional; defaults to `gpt-5-mini`)
- `FIREBASE_PROJECT_ID` or `GOOGLE_CLOUD_PROJECT`
- `URAI_SOURCE_SHA`

No provider activation, private-data processing or production deployment is implied by source presence alone.
