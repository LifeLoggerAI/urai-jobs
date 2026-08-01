import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const requiredSourceTokens = new Map([
  ['functions/src/jobs/createJob.ts', [
    'jobIdempotencyBindings',
    'buildIdempotencyBindingId',
    'buildRequestFingerprint',
    "transaction.create(logRef",
    "transaction.create(bindingRef",
    'deduplicated: true',
  ]],
  ['functions/src/events/onJobTerminalEvent.ts', [
    'jobTerminalEventOutbox',
    "eventType: 'job.terminal'",
    "status: 'PENDING'",
    'terminalEventId',
  ]],
  ['functions/src/events/publishJobTerminalEvents.ts', [
    'job-terminal-events',
    "status: 'PUBLISHING'",
    "status: 'DELIVERED'",
    "status: dead ? 'DEAD' : 'PENDING'",
    'nextOutboxRetryDelayMs',
  ]],
  ['firestore.rules', [
    'match /jobIdempotencyBindings/{bindingId}',
    'match /jobTerminalEventOutbox/{eventId}',
    'allow read, write: if false;',
  ]],
  ['functions/src/index.ts', ['publishJobTerminalEvents']],
]);

for (const [file, tokens] of requiredSourceTokens) {
  const source = fs.readFileSync(file, 'utf8');
  for (const token of tokens) {
    assert.ok(source.includes(token), `${file} is missing reliability contract token: ${token}`);
  }
}

const build = spawnSync('npm', ['run', 'build', '--prefix', 'functions'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (build.status !== 0) process.exit(build.status ?? 1);

const tests = spawnSync(process.execPath, [
  '--test',
  'functions/lib/functions/src/core/jobsReliability.test.js',
], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (tests.status !== 0) process.exit(tests.status ?? 1);

console.log('PASS jobs reliability source and runtime verification');
