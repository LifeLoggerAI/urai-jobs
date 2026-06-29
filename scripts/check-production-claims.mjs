import fs from 'node:fs';

const files = [
  'web/src/pages/LandingPage.tsx',
  'web/src/pages/CreateJobPageLocked.tsx',
  'web/src/pages/AdminPage.tsx',
  'docs/PRODUCTION_STATUS.md',
  'README.md'
];

const blocked = [
  /URAI Jobs is production worker ready/i,
  /fully live autonomous/i,
  /Queue every production workflow/i,
  /V1 through V5 autonomous/i,
  /internal production job-execution fabric/i,
  /queueing controlled production work/i,
  /Execute subsystem-specific work such as narrator TTS, asset rendering, spatial indexing, or studio processing/i,
  /urai-jobs-runtime-ci\.yml/i,
  /all workers are live/i
];

function read(file) { return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''; }
function check(name, condition) {
  if (!condition) { console.error(`[FAIL] ${name}`); process.exitCode = 1; }
  else console.log(`[PASS] ${name}`);
}

for (const file of files) {
  const content = read(file);
  if (!content) continue;
  for (const pattern of blocked) {
    check(`unsupported public claim not present in ${file}: ${pattern}`, !pattern.test(content));
  }
}

const landing = read('web/src/pages/LandingPage.tsx');
check('LandingPage says production lifecycle proof is pending', landing.includes('Production lifecycle proof still requires'));
check('LandingPage does not claim all workers are live', landing.includes('worker families remain gated'));

const status = read('docs/PRODUCTION_STATUS.md');
if (status) check('Production status doc is honest when present', status.includes('not production worker ready'));

const readme = read('README.md');
if (readme) {
  check('README says not production worker ready until lifecycle proof exists', readme.includes('must not be described as production worker ready until lifecycle proof exists'));
  check('README labels unsupported workers as gated or placeholder', readme.includes('asset, spatial, and studio workers: gated or placeholder'));
  check('README labels root and legacy workers fail-closed', readme.includes('root and legacy generic workers: gated fail-closed'));
  check('README points at actual production verification workflow', readme.includes('.github/workflows/production-verification.yml'));
  check('README says CI does not prove production smoke', readme.includes('does not prove production smoke'));
}

if (process.exitCode) process.exit(process.exitCode);
console.log('[PASS] URAI_JOBS_PRODUCTION_CLAIMS_CHECK');
