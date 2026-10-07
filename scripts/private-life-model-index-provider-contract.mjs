import fs from 'node:fs';

let failed = 0;
const check = (label, condition) => {
  if (condition) console.log(`[PASS] ${label}`);
  else { failed += 1; console.error(`[FAIL] ${label}`); }
};

const source = fs.readFileSync('workers/private-life-model-index-provider/src/index.ts', 'utf8');
const pkg = JSON.parse(fs.readFileSync('workers/private-life-model-index-provider/package.json', 'utf8'));

check('provider is an isolated workspace', pkg.name === 'private-life-model-index-provider');
check('provider requires bearer auth', source.includes('PRIVATE_SOURCE_INDEX_TOKEN') && source.includes('requireAuth'));
check('opaque refs are validated', source.includes('PRIVATE_REF') && source.includes('transcriptRef') && source.includes('provenanceRef'));
check('private resolver is required', source.includes('PRIVATE_SOURCE_REF_RESOLVER_URL') && source.includes('resolve-life-model-inputs'));
check('resolver output is rebound to requested opaque refs', source.includes("resolvedTranscriptRef !== request.transcriptRef") && source.includes("resolvedProvenanceRef !== request.provenanceRef"));
check('resolver output cannot switch source handles', source.includes("String(payload.sourceHandle) !== request.sourceHandle"));
check('raw transcript has a hard bound', source.includes('MAX_TRANSCRIPT_CHARS'));
check('raw transcript is not included in failure logs', !source.includes('transcriptText,\n      error'));
check('extractor uses bounded JSON response mode without provider retention', source.includes("response_format: { type: 'json_object' }") && source.includes('max_completion_tokens: 10000') && source.includes('store: false'));
check('synthetic-memory firewall is explicit', source.includes('syntheticOutputMayBecomeHistoricalSource: false'));
check('unknown evidence cannot enter historical source classes', source.includes('ALLOWED_EVIDENCE') && !source.slice(source.indexOf('const ALLOWED_EVIDENCE'), source.indexOf('const MAX_TRANSCRIPT_CHARS')).includes("'UNKNOWN'"));
check('correction triggers are bounded', source.includes('initial-source') && source.includes('stronger-source'));
check('idempotency is persisted', source.includes("collection('idempotency')"));
check('idempotency replay is transactionally serialized', source.includes('const existing = await tx.get(idempotencyRef)') && !source.includes('const existing = await idempotencyRef.get()'));
check('idempotent replay returns stored receipt without allocating a new revision', source.includes('replayed: true') && source.indexOf('const existing = await tx.get(idempotencyRef)') < source.indexOf("const currentRef = root.collection('state').doc('current')"));
check('resolver ownership and canonical source authority are mandatory', source.includes('payload.ownerUid !== request.ownerUid') && source.includes('requireCurrentAuthority(tx, request, resolved)') && source.includes("collection('uraiPrivateSourceReceipts')"));
check('claims remain quarantined until owner review', source.includes("status: 'disputed', synthetic: true") && source.includes("evidenceClass: 'UNKNOWN'") && source.includes('importExecutable: false') && source.includes('historicalSourceAuthority: false'));
check('execution remains explicitly hard-off', source.includes('URAI_PRIVATE_LIFE_MODEL_EXECUTION_ENABLED') && source.includes('URAI_PRIVATE_LIFE_MODEL_EXECUTION_AUTHORITY_REF'));
check('provider exception text cannot leak in logs', !source.includes('error.message') && source.includes("failureCode: 'PRIVATE_LIFE_MODEL_INDEX_FAILED'"));
check('revisions are transactionally persisted', source.includes('runTransaction') && source.includes("collection('revisions')"));
check('only private refs and hashes are returned', source.includes('memoryIndexRef: base(') && source.includes('checksum: stored.checksum'));
check('provider never returns raw transcript', !source.includes('transcript: resolved.transcriptText'));
const persistStart = source.indexOf('async function persistRevision')
const persistEnd = source.indexOf('\nfunction readiness()', persistStart)
const persistSource = persistStart >= 0 && persistEnd > persistStart ? source.slice(persistStart, persistEnd) : ''
check(
  'persisted revisions bind a hashed source handle only',
  persistSource.includes('sourceHandleHash: handleHash') && !persistSource.includes('sourceHandle: request.sourceHandle'),
);

if (failed) process.exit(1);
console.log('[PASS] PRIVATE_LIFE_MODEL_INDEX_PROVIDER_CONTRACT');
