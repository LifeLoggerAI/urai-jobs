import fs from 'node:fs';

const runtime = fs.readFileSync('functions/src/core/runtimeJobTypes.ts', 'utf8');
const catalog = fs.readFileSync('docs/ACTIVE_RUNTIME_JOB_CATALOG.md', 'utf8');

const listMatch = runtime.match(/export const ACTIVE_RUNTIME_JOB_TYPES = \[([\s\S]*?)\] as const;/);
if (!listMatch) throw new Error('ACTIVE_RUNTIME_JOB_TYPES is not statically inspectable');

const activeTypes = [...listMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
if (!activeTypes.length) throw new Error('ACTIVE_RUNTIME_JOB_TYPES is empty');

const catalogTypes = [...catalog.matchAll(/^\| \`([^\`]+)\` \|/gm)].map((match) => match[1]);

const sorted = (values) => [...values].sort();
const activeSorted = sorted(activeTypes);
const catalogSorted = sorted(catalogTypes);

if (JSON.stringify(activeSorted) !== JSON.stringify(catalogSorted)) {
  const missing = activeTypes.filter((type) => !catalogTypes.includes(type));
  const extra = catalogTypes.filter((type) => !activeTypes.includes(type));
  throw new Error(
    'RUNTIME_JOB_CATALOG_PARITY failed: ' +
    `missing=[${missing.join(',')}] extra=[${extra.join(',')}]`,
  );
}

for (const type of activeTypes) {
  const occurrences = catalogTypes.filter((candidate) => candidate === type).length;
  if (occurrences !== 1) {
    throw new Error(`RUNTIME_JOB_CATALOG_PARITY expected exactly one catalog row for ${type}; found ${occurrences}`);
  }
}

for (const required of [
  'Generated authority source: `functions/src/core/runtimeJobTypes.ts`',
  'scripts/runtime-job-catalog-contract.mjs',
  'A registry type missing here, or a catalog job type not present in the registry, is a CI failure.',
]) {
  if (!catalog.includes(required)) throw new Error(`RUNTIME_JOB_CATALOG_PARITY missing catalog authority marker: ${required}`);
}

console.log(`[PASS] RUNTIME_JOB_CATALOG_PARITY ${activeTypes.length} active types match the documented catalog`);
