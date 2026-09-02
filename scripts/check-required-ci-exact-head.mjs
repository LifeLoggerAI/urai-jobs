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
  '.github/workflows/firebase-cli-pin-guard.yml',
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
  requireText(path, source, 'GH_TOKEN: ${{ github.token }}', 'checkout must use the workflow-scoped read token');
  requireText(path, source, 'checkout_home="$RUNNER_TEMP/urai-jobs-checkout-home"', 'checkout credentials must be confined to an ephemeral home');
  requireText(path, source, 'export HOME="$checkout_home"', 'checkout must isolate Git and GitHub CLI configuration');
  requireText(path, source, 'gh auth setup-git >/dev/null', 'checkout must configure token-scoped Git authentication');
  requireText(path, source, 'git init .', 'checkout must initialize an isolated repository');
  requireText(path, source, 'git remote add origin "https://github.com/$GITHUB_REPOSITORY"', 'checkout must bind the canonical repository');
  requireText(path, source, 'git fetch --no-tags --prune --no-recurse-submodules --depth=1 origin "$TARGET_SHA"', 'workflow must shallow-fetch only the exact reviewed SHA');
  requireText(path, source, 'git checkout --detach --force "$TARGET_SHA"', 'workflow must detach at the exact reviewed SHA');
  requireText(path, source, 'git remote set-url origin "https://github.com/$GITHUB_REPOSITORY"', 'checkout must restore a credential-free canonical remote');
  requireText(path, source, 'rm -rf -- "$checkout_home"', 'checkout must delete ephemeral credential configuration before verification');
  rejectText(path, source, 'uses: actions/checkout@', 'the failing reusable checkout action is forbidden in required evidence workflows');
  rejectText(path, source, 'fetch-depth: 0', 'full-history checkout is forbidden in required PR evidence workflows');
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
  requireText(path, source, 'FIREBASE_TOOLS_VERSION: 15.24.0', 'emulator workflows must pin the approved Firebase CLI');
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
  'retention-days: 90',
  'public-repository emulator artifact must use the supported 90-day release-evidence retention',
);
rejectText(
  '.github/workflows/urai-jobs-runtime-ci.yml',
  runtimeCi,
  'retention-days: 365',
  'public-repository emulator artifact must not request unsupported 365-day retention',
);

const diagnostics = fs.readFileSync('.github/workflows/urai-jobs-typecheck-diagnostics.yml', 'utf8');
requireText(
  '.github/workflows/urai-jobs-typecheck-diagnostics.yml',
  diagnostics,
  'urai-jobs-verification-diagnostics-${{ env.TARGET_SHA }}',
  'verification diagnostic artifact must bind the exact source SHA',
);
requireText(
  '.github/workflows/urai-jobs-typecheck-diagnostics.yml',
  diagnostics,
  'retention-days: 365',
  'diagnostic artifact must use release-evidence retention',
);
requireText(
  '.github/workflows/urai-jobs-typecheck-diagnostics.yml',
  diagnostics,
  'git diff --exit-code',
  'diagnostic cleanup must reject tracked source mutation before removing generated output',
);
requireText(
  '.github/workflows/urai-jobs-typecheck-diagnostics.yml',
  diagnostics,
  'git clean -fdx',
  'diagnostic cleanup must remove generated untracked output before the final clean-tree proof',
);

if (failures.length > 0) {
  console.error('[FAIL] required exact-head CI evidence contract');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`[PASS] exact-head CI evidence contract: ${requiredWorkflows.length} workflows`);
console.log('[PASS] isolated temporary credential configuration, shallow exact-SHA fetch, detached checkout, clean tree, and frozen dependencies');
console.log('[PASS] reusable checkout action excluded from required Jobs evidence lanes after repository-specific checkout failures');
console.log('[PASS] PR/ref and exact-SHA concurrency cancel superseded runs without mixing evidence');
console.log('[PASS] emulator CLI version pinned: firebase-tools 15.24.0');
