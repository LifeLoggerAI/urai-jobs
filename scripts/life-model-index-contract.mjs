import fs from 'node:fs';

let failed = 0;
const check = (label, condition) => {
  if (condition) console.log(`[PASS] ${label}`);
  else { failed += 1; console.error(`[FAIL] ${label}`); }
};
const contract = JSON.parse(fs.readFileSync('contracts/life-model-v1.json','utf8'));
const worker = fs.readFileSync('workers/private-source-worker/src/index.ts','utf8');

check('schema version is pinned', contract.schemaVersion === 'urai-life-model-v1');
check('evidence and presentation are separate axes', Array.isArray(contract.evidenceClasses) && Array.isArray(contract.presentationClasses));
check('synthetic historical promotion is forbidden', contract.invariants.syntheticOutputMayBecomeHistoricalSource === false);
check('corrections preserve originals', contract.invariants.correctionsOverwriteOriginalEvidence === false);
check('revocation invalidates derivatives', contract.invariants.consentRevocationInvalidatesDependentDerivatives === true);
check('worker requires canonical schema from index provider', worker.includes("lifeModelSchemaVersion !== 'urai-life-model-v1'"));
check('worker requires provider synthetic-memory firewall proof', worker.includes('syntheticOutputMayBecomeHistoricalSource !== false'));
check('worker returns explicit firewall state', worker.includes('syntheticOutputMayBecomeHistoricalSource: false'));

if (failed) process.exit(1);
console.log('[PASS] LIFE_MODEL_INDEX_CONTRACT');
