const checks = [
  {
    name: 'marketplace module exists',
    status: 'PASS',
  },
  {
    name: 'marketplace api scaffold exists',
    status: 'PASS',
  },
  {
    name: 'marketplace firestore rules scaffold exists',
    status: 'PASS',
  },
  {
    name: 'marketplace storage rules scaffold exists',
    status: 'PASS',
  },
  {
    name: 'candidate workflow implemented',
    status: 'BLOCKED',
  },
  {
    name: 'employer workflow implemented',
    status: 'BLOCKED',
  },
  {
    name: 'admin moderation implemented',
    status: 'BLOCKED',
  },
  {
    name: 'production launch approved',
    status: 'BLOCKED',
  },
];

console.log('URAI Jobs Marketplace Smoke Scaffold');
console.log('-------------------------------------');

for (const check of checks) {
  console.log(`${check.status}: ${check.name}`);
}

const blocked = checks.filter((check) => check.status === 'BLOCKED');

if (blocked.length > 0) {
  console.error('\nMarketplace launch remains gated.');
  process.exit(1);
}
