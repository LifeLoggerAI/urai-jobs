import fs from 'node:fs';

const failures = [];
const read = (path) => fs.readFileSync(path, 'utf8');

function requireText(path, text, label) {
  const source = read(path);
  if (!source.includes(text)) failures.push(`${label}: ${path} is missing ${JSON.stringify(text)}`);
}

for (const [path, text, label] of [
  ['functions/src/system/buildInfo.ts', "schemaVersion: 'urai-jobs-build-info-1'", 'build-info schema'],
  ['functions/src/system/buildInfo.ts', "process.env.URAI_BUILD_SHA", 'runtime source SHA'],
  ['functions/src/system/buildInfo.ts', "process.env.URAI_ENV", 'runtime environment'],
  ['functions/src/system/buildInfo.ts', "process.env.FIREBASE_PROJECT_ID", 'runtime project identity'],
  ['functions/src/system/buildInfo.ts', "Cache-Control", 'non-cacheable runtime identity'],
  ['functions/src/index.ts', 'export { buildInfo } from "./system/buildInfo.js";', 'deployed build-info export'],
  ['scripts/deploy-firebase.sh', 'URAI_BUILD_SHA=${DEPLOY_SOURCE_SHA}', 'exact SHA runtime injection'],
  ['scripts/deploy-firebase.sh', "{ source: '/api/buildinfo', function: 'buildInfo' }", 'Hosting build-info rewrite'],
  ['scripts/deploy-firebase.sh', "buildInfoPath: '/api/buildinfo'", 'build-info receipt path'],
  ['scripts/deploy-firebase.sh', 'buildInfoExpectedSha: process.env.DEPLOY_SOURCE_SHA', 'receipt expected SHA'],
  ['scripts/deploy-firebase.sh', 'runtimeIdentityVerified: false', 'non-self-certifying mutation receipt'],
  ['scripts/verify-custom-domains.mjs', '`${base}/api/buildinfo`', 'public build-info request'],
  ['scripts/verify-custom-domains.mjs', 'buildInfo?.sourceSha === expectedSha', 'public SHA equality'],
  ['scripts/verify-custom-domains.mjs', 'buildInfo?.environment === expectedEnvironment', 'public environment equality'],
  ['scripts/verify-custom-domains.mjs', 'buildInfo?.projectId === projectId', 'public project equality'],
  ['scripts/verify-custom-domains.mjs', 'result.ok && result.hasAppShell && result.identityMatches', 'combined app and identity gate'],
]) requireText(path, text, label);

const deploy = read('scripts/deploy-firebase.sh');
if (deploy.includes('runtimeIdentityVerified: true')) {
  failures.push('mutation-side Firebase receipt must not self-certify public runtime identity');
}

const verifier = read('scripts/verify-custom-domains.mjs');
if (!verifier.includes('process.exit(1)')) failures.push('public identity verifier must fail closed');
if (verifier.includes('identityMatches: true')) failures.push('public identity result must not be hard-coded');

if (failures.length) {
  console.error('[FAIL] Firebase runtime identity contract');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[PASS] Firebase build-info endpoint is exported and source-bound');
console.log('[PASS] temporary Hosting config exposes exact runtime identity');
console.log('[PASS] mutation receipt does not self-certify runtime identity');
console.log('[PASS] public verification requires exact SHA, environment, project and app shell');
