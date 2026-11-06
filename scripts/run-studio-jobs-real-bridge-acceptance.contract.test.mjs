// Review-only negative preflight regression for the original Studio->Jobs runner.
// Disposable Git checkouts and explicitly stubbed pnpm/npx: NOT Firebase runtime proof.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const scriptText = readFileSync(join(here, 'run-studio-jobs-real-bridge-acceptance.sh'), 'utf8');
const STUDIO_SHA = '153d6c35557c66a8b9f8629778ca796b83730464';

function fixture({ studio = false, preexistingEnv = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'urai-r818-bridge-guard-'));
  const repo = join(dir, 'repo');
  const bin = join(dir, 'bin');
  const studioDir = join(dir, 'studio');
  mkdirSync(join(repo, 'scripts'), { recursive: true });
  mkdirSync(bin);
  const script = join(repo, 'scripts', 'run-studio-jobs-real-bridge-acceptance.sh');
  writeFileSync(script, scriptText, { mode: 0o755 });
  if (preexistingEnv) {
    mkdirSync(join(repo, 'functions'));
    writeFileSync(join(repo, 'functions/.env.demo-urai-jobs'), 'DISPOSABLE_TEST_MARKER=1\n');
  }
  const actualGit = '/usr/bin/git';
  function git(...args) {
    return execFileSync(actualGit, args, { cwd: repo, encoding: 'utf8' }).trim();
  }
  git('init', '-q');
  git('config', 'user.name', 'UrAi synthetic CI');
  git('config', 'user.email', 'synthetic@invalid.test');
  git('add', '.');
  git('commit', '-qm', 'disposable guard fixture');
  const sha = git('rev-parse', 'HEAD');
  assert.match(sha, /^[0-9a-f]{40}$/);
  if (studio) {
    mkdirSync(join(studioDir, '.git'), { recursive: true });
  }
  const pnpmLog = join(dir, 'pnpm.log');
  const npxLog = join(dir, 'npx.log');
  const pnpm = join(bin, 'pnpm');
  writeFileSync(pnpm, `#!/bin/sh
if [ "$1" = "--version" ]; then echo 8.15.9; exit 0; fi
printf '%s\\n' "$*" >> "$URAI_TEST_PNPM_LOG"
if [ "${'${URAI_TEST_FAIL_STAGE:-}'}" = "typecheck" ] && [ "$1" = "typecheck" ]; then exit 63; fi
if [ "${'${URAI_TEST_FAIL_STAGE:-}'}" = "build" ] && [ "$1" = "build" ]; then exit 64; fi
exit 0
`, { mode: 0o755 });
  const npx = join(bin, 'npx');
  writeFileSync(npx, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$URAI_TEST_NPX_LOG"\nexit 81\n', { mode: 0o755 });
  const shimGit = join(bin, 'git');
  writeFileSync(shimGit, `#!/bin/sh
if [ "$1" = "-C" ] && [ "$2" = "${studioDir}" ]; then
  if [ "$3" = "rev-parse" ]; then echo ${STUDIO_SHA}; exit 0; fi
  if [ "$3" = "status" ]; then exit 0; fi
fi
exec ${actualGit} "$@"
`, { mode: 0o755 });
  // The negative guards need only command discovery, not a Java runtime.
  // A dummy Java executable makes these checks independent of CI images.
  writeFileSync(join(bin, 'java'), '#!/bin/sh\nexit 91\n', { mode: 0o755 });
  chmodSync(script, 0o755);
  const env = {
    PATH: `${bin}:${process.env.PATH || '/usr/bin:/bin'}`,
    HOME: dir,
    LANG: 'C',
    URAI_ACCEPTANCE_SHA: sha,
    URAI_TEST_PNPM_LOG: pnpmLog,
    URAI_TEST_NPX_LOG: npxLog,
    ...(studio ? { URAI_STUDIO_SOURCE_DIR: studioDir } : {}),
  };
  function run(overrides = {}) {
    const r = spawnSync('bash', [script], {
      cwd: repo,
      env: { ...env, ...overrides },
      encoding: 'utf8', timeout: 6500,
    });
    return { status: r.status, stderr: r.stderr || '', stdout: r.stdout || '', error: r.error,
      pnpm: safeRead(pnpmLog), npx: safeRead(npxLog) };
  }
  return { dir, repo, run, dispose: () => rmSync(dir, { recursive: true, force: true }) };
}
function safeRead(path) { try { return readFileSync(path, 'utf8'); } catch { return ''; } }

const forbidden = [
  ['FIREBASE_CONFIG', '{"projectId":"urai-production"}'],
  ['GCS_BUCKET_NAME', 'urai-live-media'],
  ['FIREBASE_STORAGE_BUCKET', 'urai-live-media'],
  ['GOOGLE_CLOUD_STORAGE_BUCKET', 'urai-live-media'],
  ['STORAGE_EMULATOR_HOST', 'production.invalid:9199'],
  ['FIREBASE_FUNCTIONS_EMULATOR_HOST', 'production.invalid:5001'],
  ['FIREBASE_CLI_TOKEN', 'synthetic-do-not-use'],
  ['OPENAI_API_KEY', 'synthetic-do-not-use'],
  ['STRIPE_SECRET_KEY', 'synthetic-do-not-use'],
  ['URAI_STUDIO_JOBS_BRIDGE_TOKEN', 'synthetic-should-not-inherit'],
  ['URAI_JOBS_BRIDGE_URL', 'https://jobs.production.invalid'],
];

test('R818 Studio-to-Jobs runner rejects inherited cloud, remote emulator and secret configuration before install', async (t) => {
  for (const [name, value] of forbidden) {
    await t.test(name, () => {
      const f = fixture();
      try {
        const r = f.run({ [name]: value });
        assert.equal(r.error, undefined);
        assert.equal(r.status, 1, `${name}: ${r.stderr}`);
        assert.match(r.stderr, new RegExp(`${name} (must be|credential present)`));
        assert.equal(r.pnpm, '', `${name}: no install or build permitted`);
        assert.equal(r.npx, '', `${name}: no emulators permitted`);
      } finally { f.dispose(); }
    });
  }
  await t.test('existing emulator .env blocked before install', () => {
    const f = fixture({ preexistingEnv: true });
    try {
      const r = f.run();
      assert.equal(r.status, 1, r.stderr);
      assert.match(r.stderr, /Existing emulator environment file/);
      assert.equal(r.pnpm, '');
      assert.equal(r.npx, '');
    } finally { f.dispose(); }
  });
  await t.test('with no inherited cloud env, gate reaches missing Studio checkout instead of silently launching', () => {
    const f = fixture();
    try {
      const r = f.run();
      assert.equal(r.status, 1, r.stderr);
      assert.match(r.stderr, /external Studio checkout missing/);
      assert.equal(r.pnpm, '');
      assert.equal(r.npx, '');
    } finally { f.dispose(); }
  });
});

test('R818 original full workspace typecheck/build failures precede emulator invocation', async (t) => {
  for (const [stage, expectedEnd] of [['typecheck', 'typecheck'], ['build', 'build']]) {
    await t.test(`${stage} failure blocks emulators`, () => {
      const f = fixture({ studio: true });
      try {
        const r = f.run({ URAI_TEST_FAIL_STAGE: stage });
        assert.equal(r.error, undefined);
        assert.equal(r.status, stage === 'typecheck' ? 63 : 64, r.stderr + r.stdout);
        assert.equal(r.npx, '', 'No Firebase CLI called before original full build passes');
        const actual = r.pnpm.trim().split('\n').map(s => s.trim());
        const expected = ['install --frozen-lockfile', '--filter @urai-jobs/shared-types build', '--filter urai-jobs-functions build', 'typecheck'];
        if (stage === 'build') expected.push('build');
        assert.deepEqual(actual, expected);
        assert.equal(actual.at(-1), expectedEnd);
      } finally { f.dispose(); }
    });
  }
});
