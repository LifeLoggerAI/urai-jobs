import fs from 'node:fs';
import { validateRollbackConfigurationReceipt } from './verify-rollback-revision.mjs';

const receiptPath = process.argv[2];
if (!receiptPath) {
  console.error('Usage: node scripts/validate-rollback-config-receipt.mjs <receipt.json>');
  process.exit(2);
}

const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
validateRollbackConfigurationReceipt(receipt);
console.log(`[PASS] rollback configuration receipt validated: ${receiptPath}`);
