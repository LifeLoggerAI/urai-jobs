import fs from 'node:fs';

const requiredFiles = [
  'marketplace/README.md',
  'marketplace/package.json',
  'marketplace/functions/env.ts',
  'marketplace/functions/firebase-admin.ts',
  'marketplace/functions/http-runtime.ts',
  'marketplace/functions/dispatcher.ts',
  'marketplace/functions/http-routes.ts',
  'marketplace/functions/token-verification.ts',
  'marketplace/functions/responses.ts',
  'marketplace/functions/signed-upload.ts',
  'marketplace/functions/firestore-repositories.ts',
  'marketplace/rules/firestore.marketplace.rules',
  'marketplace/storage/storage.marketplace.rules',
  'docs/marketplace/SIGNOFF_LEDGER.md',
  'docs/marketplace/QA_MATRIX.md',
  'docs/marketplace/DEPLOYMENT_CHECKLIST.md',
];

const missing = requiredFiles.filter((file) => !fs.existsSync(file));

console.log('Marketplace Preflight');
console.log('---------------------');

for (const file of requiredFiles) {
  console.log(`${fs.existsSync(file) ? 'PASS' : 'MISSING'}: ${file}`);
}

if (missing.length > 0) {
  console.error(`\nMissing required files: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('\nPreflight passed. Launch remains gated until signoffs and runtime verification are complete.');
