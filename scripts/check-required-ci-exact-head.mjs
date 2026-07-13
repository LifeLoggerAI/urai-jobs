import fs from 'node:fs';

const requiredWorkflows = [
  '.github/workflows/ci.yml',
  '.github/workflows/system-audit.yml',
  '.github/workflows/urai-jobs-ci.yml',
  '.github/workflows/urai-jobs-runtime-ci.yml',
  '.github/workflows/urai-production-verify.yml',
  '.github/workflows/urai-jobs-typecheck-diagnostics.yml',
  '.github/workflows/career-surfaces-ci.yml',
  '.github/workflows/urai-jobs-final-ci.yml',
  '.github/workflows/production-verification.yml',
];

const failures = [];

function requireText(path, source, text, reason) {
  if (!source.includes(text)) failures.push(`${path}: ${reason}; missing ${JSON.stringify(text)}`);
}

function rejectText(path, source, text, reason) {
  if (source.includes(text)) failures.push(`${path}: ${reason}; found ${JSON.stringify(text)}`);
}

for (const path of requiredWorkflows) {
  if (!fs.existsSync(path)) {
    failures.push(`${path}: required workflow is missing`);
    continue;
  }
  const source = fs.readFileSync(path, 'utf8');
  requireText(path, source, 'permissions:', 'workflow must declare minimal permissions');
  requireText(path, source, 'contents: read', 'workflow must use read-only repository contents permission');
  requireText(path, source, 'TARGET_SHA:', 'workflow must resolve an exact source SHA');
  requireText(path, source, 'ref: ${{ env.TARGET_SHA }}', 'workflow must checkout the resolved exact source SHA');
  requireText(path, source, 'fetch-depth: 1', 'workflow must fetch only the exact reviewed source SHA');
  rejectText(path, source, 'fetch-depth: 0', 'full-history checkout is forbidden in required PR evidence workflows');
  requireText(path, source, 'persist-credentials: false', 'workflow must not persist checkout credentials');
  requireText(path, source, 'test "$(git rev-parse HEAD)" = "$TARGET_SHA"', 'workflow must prove checked-out source identity');
  requireText(path, source, 'git status --porcelain --untracked-files=all', 'workflow must prove a clean source tree');
  rejectText(path, source, 'pnpm install --no-frozen-lockfile', 'mutable pnpm installation is forbidden');
  rejectText(path, source, 'pnpm install --frozen-lockfile=false', 'mutable pnpm installation is forbidden');
  rejectText(path, source, 'corepack prepare pnpm@latest', 'mutable pnpm tool version is forbidden');
  rejectText(path, source, 'firebase-tools@latest', 'mutable Firebase CLI version is forbidden');

  const concurrencyMatch = source.match(/\nconcurrency:\n([\s\S]*?)(?=\nenv:|\njobs:)/);
  if (!concurrencyMatch) {
    failures.push(`${path}: workflow must define PR/ref-and-SHA-scoped concurrency`);
  } else {
    const concurrency = concurrencyMatch[0];
    requireText(path, concurrency, 'github.event.pull_request.number || github.ref', 'concurrency must identify the PR or ref');
    requireText(path, concurrency, 'github.event.pull_request.head.sha || github.sha', 'concurrency must isolate evidence by exact reviewed SHA');
    requireText(path, concurrency, 'cancel-in-progress: true', 'superseded runs must be cancelled');
  }

  if (source.includes('pnpm install')) {
    requireText(path, source, 'pnpm install --frozen-lockfile', 'pnpm workflows must install the exact lockfile graph');
    requireText(path, source, 'Prove install preserved exact source', 'pnpm workflows must prove installation did not mutate source');
  }
}

const jobsCi = fs.readFileSync('.github/workflows/urai-jobs-ci.yml', 'utf8');
const runtimeCi = fs.readFileSync('.github/workflows/urai-jobs-runtime-ci.yml', 'utf8');
for (const [path, source] of [
  ['.github/workflows/urai-jobs-ci.yml', jobsCi],
  ['.github/workflows/urai-jobs-runtime-ci.yml', runtimeCi],
]) {
  requireText(path, source, 'FIREBASE_TOOLS_VERSION: 15.23.0', 'emulator workflows must pin the approved Firebase CLI');
  requireText(path, source, 'firebase-tools@${FIREBASE_TOOLS_VERSION}', 'emulator execution must use the pinned Firebase CLI');
}

requireText(
  '.github/workflows/urai-jobs-runtime-ci.yml',
  runtimeCi,
  'urai-jobs-emulator-e2e-${{ env.TARGET_SHA }}',
  'emulator artifact must bind the exact source SHA',
);
requireText(
  '.github/workflows/urai-jobs-runtime-ci.yml',
  runtimeCi,
  'retention-days: 365',
  'emulator artifact must use release-evidence retention',
);

const diagnostics = fs.readFileSync('.github/workflows/urai-jobs-typecheck-diagnostics.yml', 'utf8');
requireText(
  '.github/workflows/urai-jobs-typecheck-diagnostics.yml',
  diagnostics,
  'urai-jobs-typecheck-diagnostics-${{ env.TARGET_SHA }}',
  'diagnostic artifact must bind the exact source SHA',
);
requireText(
  '.github/workflows/urai-jobs-typecheck-diagnostics.yml',
  diagnostics,
  'retention-days: 365',
  'diagnostic artifact must use release-evidence retention',
);

if (failures.length > 0) {
  console.error('[FAIL] required exact-head CI evidence contract');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`[PASS] exact-head CI evidence contract: ${requiredWorkflows.length} workflows`);
console.log('[PASS] shallow exact source checkout, clean tree, frozen dependencies, read-only checkout credentials');
console.log('[PASS] PR/ref and exact-SHA concurrency cancel superseded runs without mixing evidence');
console.log('[PASS] emulator CLI version pinned: firebase-tools 15.23.0');
