// Nonproduction, explicit local acceptance launcher. No deploy, merges or provider spend.
// Runs existing source tests then the REAL Firestore emulator integration gate.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PROJECT_ID = 'demo-urai-jobs';
const FIREBASE_TOOLS = 'firebase-tools@15.24.0';
const SHA = /^[a-f0-9]{40}$/;
const fail = (code, detail = '') => {
  console.error(code + (detail ? ': ' + detail : ''));
  process.exit(2);
};
function run(exe, args, options = {}) {
  const result = spawnSync(exe, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.stdio || 'pipe',
    timeout: options.timeout || 10000,
    env: options.env || process.env,
    shell: false,
    windowsHide: true,
  });
  return result;
}
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--sha' || !SHA.test(args[1])) {
  fail('CHALK_PINNED_SHA_REQUIRED', 'node scripts/chalk-firestore-local.mjs --sha <exact-40-character-SHA>');
}
const expectedSha = args[1];
if (process.env.FIRESTORE_EMULATOR_HOST) fail('CHALK_PARENT_EMULATOR_HOST_REFUSED');
if (process.env.GOOGLE_CLOUD_PROJECT && !process.env.GOOGLE_CLOUD_PROJECT.startsWith('demo-')) {
  fail('CHALK_REAL_CLOUD_PROJECT_REFUSED');
}
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor !== 22) fail('CHALK_NODE22_REQUIRED', process.version);
const head = run('git', ['rev-parse', 'HEAD']);
if (head.status !== 0 || head.stdout.trim() !== expectedSha) fail('CHALK_PINNED_SOURCE_MISMATCH');
const status = run('git', ['status', '--porcelain', '--untracked-files=all']);
if (status.status !== 0 || status.stdout.trim()) fail('CHALK_UNCLEAN_WORKTREE');
const java = run('java', ['-version']);
if (java.status !== 0) fail('CHALK_JAVA_REQUIRED', 'Install Java 21 for Firestore emulator');
const require = createRequire(new URL('../functions/package.json', import.meta.url));
try { require.resolve('firebase-admin/firestore'); }
catch { fail('CHALK_FIREBASE_ADMIN_REQUIRED', 'Install the existing Jobs dependency graph using pnpm install --frozen-lockfile'); }

console.log('CHALK_EXACT_SOURCE ' + expectedSha);
const source = run(process.execPath, ['--test',
  'scripts/chalk-engineering-continuity.test.mjs',
  'scripts/chalk-engineering-verify.test.mjs',
  'scripts/chalk-firestore-checkpoint.test.mjs',
  'scripts/chalk-checkpoint-binding.test.mjs',
  'scripts/chalk-repository-identity.test.mjs',
  'scripts/chalk-firestore-canonical.test.mjs',
  'scripts/chalk-firestore-local.test.mjs',
], { stdio: 'inherit', timeout: 120000 });
if (source.status !== 0) fail('CHALK_SOURCE_TESTS_FAILED');
console.log('CHALK_SOURCE_TESTS_PASSED ' + expectedSha);
// Explicit allowlist prevents credentials, tokens and arbitrary NODE_OPTIONS from
// flowing into the installer/emulator subprocess.
const kept = new Set(['PATH', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA',
  'TEMP', 'TMP', 'TMPDIR', 'SYSTEMROOT', 'COMSPEC', 'LANG', 'LC_ALL', 'NO_PROXY']);
const env = Object.fromEntries(Object.entries(process.env)
  .filter(([key]) => kept.has(key.toUpperCase())));
Object.assign(env, { GOOGLE_CLOUD_PROJECT: PROJECT_ID, GCLOUD_PROJECT: PROJECT_ID,
  FIREBASE_CLI_DISABLE_TELEMETRY: '1' });
const cli = ['--yes', FIREBASE_TOOLS, '--project', PROJECT_ID,
  'emulators:exec', '--only', 'firestore', 'node scripts/chalk-firestore-emulator-run.mjs'];
// Windows cmd shims cannot be invoked with shell:false in Node 22.
// This command string is constant: no user-controlled arguments are interpolated.
const onWindows = process.platform === 'win32';
const emulator = run(onWindows ? (process.env.ComSpec || 'cmd.exe') : 'npx',
  onWindows ? ['/d', '/s', '/c', 'npx ' + cli.join(' ')] : cli,
  { stdio: 'inherit', timeout: 600000, env });
if (emulator.status !== 0) fail('CHALK_REAL_FIRESTORE_ACCEPTANCE_FAILED', emulator.error?.message || String(emulator.status));
console.log('CHALK_REAL_FIRESTORE_ACCEPTANCE_PASSED ' + expectedSha);
