// Nonproduction, bounded Git source-verification adapter for UrAi engineering jobs.
// IMPORTANT: Node tests are executable code. Use only in an isolated, least-privilege
// worker without production credentials, network access, or private user data.
// This module NEVER edits code, invokes a model, publishes PRs, or deploys.
import { createHash } from 'node:crypto';
import { execFile as callbackExecFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { relative, resolve, isAbsolute, sep } from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(callbackExecFile);
const HEX40 = /^[a-f0-9]{40}$/;
const TEST_NAME = /(?:^|\/)\w[\w./-]*\.test\.mjs$/;
const fail = code => { throw new Error(`ENGINEERING_VERIFY_${code}`); };
const digest = value => createHash('sha256').update(value).digest('hex');
const cleanEnv = () => ({ PATH: process.env.PATH || '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C' });

async function insideRoot(root, file) {
  if (typeof file !== 'string' || !TEST_NAME.test(file) || file.includes('\\') ||
    isAbsolute(file) || file.split('/').includes('..')) fail('PATH');
  const canonicalRoot = await realpath(root);
  const canonicalFile = await realpath(resolve(canonicalRoot, file));
  const delta = relative(canonicalRoot, canonicalFile);
  if (!delta || delta === '..' || delta.startsWith(`..${sep}`) || isAbsolute(delta)) fail('PATH');
  return { canonicalRoot, canonicalFile };
}

async function cleanPinnedCheckout(root, sha) {
  const options = { cwd: root, timeout: 10000, maxBuffer: 131072, env: cleanEnv() };
  const head = (await execFile('git', ['rev-parse', '--verify', 'HEAD'], options)).stdout.trim();
  if (!HEX40.test(head) || head !== sha) fail('SOURCE_SHA_MISMATCH');
  // A matching HEAD alone cannot prove the files used by the test are the
  // committed contents. Reject tracked changes and unexpected untracked files.
  const status = (await execFile('git', ['status', '--porcelain', '--untracked-files=all'], options)).stdout;
  if (status.trim()) fail('UNCLEAN_WORKTREE');
  return head;
}

export async function verifyPinnedSource({ store, jobId, ownerUid, token, workspace, testFile, leaseMs = 60000 }) {
  if (!store || typeof store.read !== 'function' || typeof store.claim !== 'function' || typeof store.complete !== 'function') fail('STORE');
  const state = await store.read({ jobId, ownerUid });
  if (state.status === 'COMPLETED') return { state, replay: true };
  if (!HEX40.test(state.baseSha)) fail('SOURCE_SHA_INPUT');
  const { canonicalRoot, canonicalFile } = await insideRoot(workspace, testFile);
  // Check the immutable checkout BEFORE claiming a lease to avoid marking
  // the task RUNNING on an invalid revision or dirty worktree.
  await cleanPinnedCheckout(canonicalRoot, state.baseSha);
  const claimed = await store.claim({ jobId, ownerUid, token, leaseMs });
  const output = await execFile(process.execPath, ['--test', canonicalFile], {
    cwd: canonicalRoot, timeout: 30000, maxBuffer: 524288,
    env: cleanEnv(),
  });
  const sourceSha = await cleanPinnedCheckout(canonicalRoot, claimed.baseSha);
  const resultDigest = digest(`${sourceSha}\n${output.stdout}\n${output.stderr}`);
  const complete = await store.complete({
    jobId, ownerUid, token, generation: claimed.generation,
    expectedRevision: claimed.revision, resultDigest, sourceSha
  });
  return { state: complete, replay: false };
}
