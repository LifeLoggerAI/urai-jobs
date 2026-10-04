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
check('extractor uses deterministic JSON response mode', source.includes("response_format: { type: 'json_object' }") && source.includes('temperature: 0'));
check('synthetic-memory firewall is explicit', source.includes('syntheticOutputMayBecomeHistoricalSource: false'));
check('unknown evidence cannot enter historical source classes', source.includes('ALLOWED_EVIDENCE') && !source.includes("'UNKNOWN',"));
check('correction triggers are bounded', source.includes('initial-source') && source.includes('stronger-source'));
check('idempotency is persisted', source.includes("collection('idempotency')"));
check('idempotency replay is transactionally serialized', source.includes('const existing = await tx.get(idempotencyRef)') && !source.includes('const existing = await idempotencyRef.get()'));
check('idempotent replay returns stored receipt without allocating a new revision', source.includes('replayed: true') && source.indexOf('const existing = await tx.get(idempotencyRef)') < source.indexOf("const currentRef = root.collection('state').doc('current')"));
check('revisions are transactionally persisted', source.includes('runTransaction') && source.includes("collection('revisions')"));
check('only private refs and hashes are returned', source.includes('memoryIndexRef: base(') && source.includes('checksum: stored.checksum'));
check('provider never returns raw transcript', !source.includes('transcript: resolved.transcriptText'));
check('persisted revisions bind a hashed source handle only', source.includes('sourceHandleHash: handleHash') && !/const record = \{[\s\S]*sourceHandle: request\.sourceHandle[\s\S]*\};/.test(source));

if (failed) process.exit(1);
console.log('[PASS] PRIVATE_LIFE_MODEL_INDEX_PROVIDER_CONTRACT');
