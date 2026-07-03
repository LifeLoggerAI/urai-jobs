import fs from 'node:fs';

const file = 'functions/src/release/releaseSequencePlan.ts';
const source = fs.readFileSync(file, 'utf8');
const required = [
  "'v1'", "'v2'", "'v3'", "'v4'", "'v5'",
  "'audit'", "'world-spec'", "'asset-inventory'", "'forge-models'",
  "'integrate'", "'verify-web'", "'verify-device'", "'promote'",
  "mode: 'plan-only'", 'readyForExecution: false',
];

for (const token of required) {
  if (!source.includes(token)) {
    console.error(`Release sequence verifier missing token: ${token}`);
    process.exit(1);
  }
}

console.log('PASS release sequence verifier');
