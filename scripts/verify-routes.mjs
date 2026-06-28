import fs from 'node:fs';

const app = fs.readFileSync('web/src/App.tsx', 'utf8');
const gate = fs.readFileSync('web/src/components/AuthGate.tsx', 'utf8');
const checks = [
  ['create route gated', app.includes('CreateJobPageLocked') && app.includes('AuthGate')],
  ['admin route gated', app.includes('AdminPage') && app.includes('requireOperator')],
  ['privacy route present', app.includes('/privacy')],
  ['terms route present', app.includes('/terms')],
  ['trust route present', app.includes('/trust')],
  ['gate has locked state', gate.includes('This URAI Jobs surface is locked')],
  ['gate has operator state', gate.includes('Operator access required')]
];
let failed = false;
for (const [name, ok] of checks) {
  if (ok) console.log(`[PASS] ${name}`);
  else { console.error(`[FAIL] ${name}`); failed = true; }
}
if (failed) process.exit(1);
console.log('[PASS] URAI_JOBS_ROUTE_VERIFICATION');
