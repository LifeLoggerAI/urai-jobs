import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

// Tests the actual standalone runner in a disposable Git checkout, with fake
// pnpm/npx commands that can never install dependencies or start emulators.
// This is an executable preflight contract, NOT four-emulator acceptance.
test('external source pin and offline safety gates reject unsafe Jobs acceptance', {
  skip: process.platform === 'win32' ? 'Bash runner is for Linux/macOS' : false,
}, async t => {
  const root = mkdtempSync(join(tmpdir(), 'urai-jobs-acceptance-guard-'))
  try {
    const repo = join(root, 'synthetic-repo')
    const scripts = join(repo, 'scripts')
    const bin = join(root, 'offline-bin')
    const badBin = join(root, 'wrong-pnpm-bin')
    mkdirSync(scripts, { recursive: true })
    mkdirSync(bin)
    mkdirSync(badBin)
    const runner = join(scripts, 'run-four-emulator-acceptance.sh')
    copyFileSync(fileURLToPath(new URL('./run-four-emulator-acceptance.sh', import.meta.url)), runner)

    const stub = (directory, name, contents) => {
      const file = join(directory, name)
      writeFileSync(file, '#!/bin/sh\n' + contents, { mode: 0o755 })
      chmodSync(file, 0o755)
    }
    stub(bin, 'pnpm', 'if [ "$1" = "--version" ]; then echo 8.15.9; exit 0; fi\necho OFFLINE_STUB_PNPM >&2\nexit 73\n')
    stub(badBin, 'pnpm', 'if [ "$1" = "--version" ]; then echo 8.15.8; exit 0; fi\necho OFFLINE_STUB_PNPM >&2\nexit 73\n')
    for (const directory of [bin, badBin]) {
      stub(directory, 'java', 'exit 0\n')
      stub(directory, 'npx', 'echo UNEXPECTED_NPX >&2\nexit 74\n')
    }

    const git = (args) => {
      const result = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', timeout: 5000 })
      assert.equal(result.status, 0, 'Git fixture failed: ' + result.stderr)
      return result.stdout.trim()
    }
    git(['init', '-q'])
    git(['add', 'scripts/run-four-emulator-acceptance.sh'])
    git(['-c', 'user.email=offline-test@example.invalid', '-c', 'user.name=Offline Test', 'commit', '-qm', 'Synthetic guard fixture'])
    const sha = git(['rev-parse', 'HEAD'])
    assert.match(sha, /^[0-9a-f]{40}$/)
    assert.ok(readFileSync(runner, 'utf8').includes('URAI_ACCEPTANCE_SHA'))

    const baseEnv = { ...process.env }
    for (const key of [
      'URAI_ACCEPTANCE_SHA', 'GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN', 'FIREBASE_CLI_TOKEN',
      'GOOGLE_OAUTH_ACCESS_TOKEN', 'GOOGLE_CLOUD_ACCESS_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN',
      'RUNPOD_API_KEY', 'STRIPE_SECRET_KEY', 'OPENAI_API_KEY', 'GCLOUD_PROJECT',
      'GOOGLE_CLOUD_PROJECT', 'FIREBASE_PROJECT_ID', 'CLOUDSDK_CORE_PROJECT',
      'FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST',
      'FIREBASE_STORAGE_EMULATOR_HOST', 'FUNCTIONS_EMULATOR_HOST',
    ]) delete baseEnv[key]
    const invoke = (overrides = {}, directory = bin) => {
      const result = spawnSync('bash', [runner], {
        cwd: repo, encoding: 'utf8', timeout: 8000,
        env: { ...baseEnv, PATH: directory + ':' + (process.env.PATH ?? ''), ...overrides },
      })
      assert.equal(result.error, undefined, result.error?.message)
      return { status: result.status, output: result.stdout + '\n' + result.stderr }
    }
    const denied = (result, expected, exit = 1) => {
      assert.equal(result.status, exit, result.output)
      assert.match(result.output, expected)
      assert.doesNotMatch(result.output, /URAI_FOUR_EMULATOR_ACCEPTANCE_PASS/)
      assert.doesNotMatch(result.output, /UNEXPECTED_NPX/)
    }

    await t.test('rejects a missing reviewed commit', () => {
      denied(invoke(), /Externally reviewed URAI_ACCEPTANCE_SHA is required/)
    })
    await t.test('rejects a malformed reviewed commit', () => {
      denied(invoke({ URAI_ACCEPTANCE_SHA: 'garbage' }), /Expected SHA must be a full 40-digit git commit/)
    })
    await t.test('rejects a mismatched reviewed commit', () => {
      denied(invoke({ URAI_ACCEPTANCE_SHA: 'a'.repeat(40) }), /Checked-out HEAD differs/)
    })
    await t.test('rejects a dirty checkout', () => {
      const dirty = join(repo, 'untracked.txt')
      writeFileSync(dirty, 'untracked')
      try { denied(invoke({ URAI_ACCEPTANCE_SHA: sha }), /Working tree must be clean/) }
      finally { rmSync(dirty) }
    })
    await t.test('rejects an incorrect pnpm version', () => {
      denied(invoke({ URAI_ACCEPTANCE_SHA: sha }, badBin), /Exact pnpm 8\.15\.9 required/)
    })
    await t.test('rejects a real Firebase project', () => {
      denied(invoke({ URAI_ACCEPTANCE_SHA: sha, GCLOUD_PROJECT: 'urai-4dc1d' }), /GCLOUD_PROJECT points outside disposable emulator project/)
    })
    await t.test('rejects production credential exposure', () => {
      denied(invoke({ URAI_ACCEPTANCE_SHA: sha, GOOGLE_APPLICATION_CREDENTIALS: '/tmp/fictional-key.json' }), /GOOGLE_APPLICATION_CREDENTIALS must be absent/)
    })
    await t.test('rejects preselected remote Storage emulator', () => {
      denied(invoke({ URAI_ACCEPTANCE_SHA: sha, FIREBASE_STORAGE_EMULATOR_HOST: 'example.invalid:9199' }), /FIREBASE_STORAGE_EMULATOR_HOST must be unset/)
    })
    await t.test('clean approved checkout reaches only the offline install stub', () => {
      const result = invoke({ URAI_ACCEPTANCE_SHA: sha })
      denied(result, /OFFLINE_STUB_PNPM/, 73)
      assert.match(result.output, /URAI_FOUR_EMULATOR_SOURCE/)
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
