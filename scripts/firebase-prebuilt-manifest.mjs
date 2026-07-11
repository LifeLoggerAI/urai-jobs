#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'docs/release-evidence/firebase-prebuilt-manifest.json');
const roots = ['packages/shared-types/dist', 'functions/lib', 'web/dist'];
const shaPattern = /^[0-9a-f]{40}$/;
const writeMode = process.argv.includes('--write');
const verifyMode = process.argv.includes('--verify');
if (writeMode === verifyMode) throw new Error('Choose exactly one of --write or --verify.');

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function exactSourceSha() {
  const expected = String(process.env.DEPLOY_SOURCE_SHA || '').trim();
  const actual = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (!shaPattern.test(expected) || expected !== actual) {
    throw new Error(`Firebase prebuilt source mismatch: expected=${expected || '<missing>'} actual=${actual}`);
  }
  return actual;
}

function collectFiles() {
  const files = [];
  for (const relativeRoot of roots) {
    const absoluteRoot = path.join(root, relativeRoot);
    if (!fs.existsSync(absoluteRoot) || !fs.statSync(absoluteRoot).isDirectory()) {
      throw new Error(`Missing Firebase prebuilt output directory: ${relativeRoot}`);
    }
    const pending = [absoluteRoot];
    while (pending.length) {
      const directory = pending.pop();
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        const relative = path.relative(root, absolute).split(path.sep).join('/');
        const stat = fs.lstatSync(absolute);
        if (stat.isSymbolicLink()) throw new Error(`Firebase prebuilt output contains a symlink: ${relative}`);
        if (stat.isDirectory()) pending.push(absolute);
        else if (stat.isFile()) {
          const bytes = fs.readFileSync(absolute);
          files.push({ path: relative, size: bytes.length, sha256: sha256(bytes) });
        } else {
          throw new Error(`Unsupported Firebase prebuilt output type: ${relative}`);
        }
      }
    }
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  if (!files.length) throw new Error('Firebase prebuilt output is empty.');
  return files;
}

const sourceSha = exactSourceSha();
const files = collectFiles();
const totals = {
  fileCount: files.length,
  totalBytes: files.reduce((total, file) => total + file.size, 0),
};

if (writeMode) {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  const manifest = {
    schemaVersion: 'urai-jobs-firebase-prebuilt-1',
    generatedAt: new Date().toISOString(),
    repository: process.env.GITHUB_REPOSITORY || 'LifeLoggerAI/urai-jobs',
    workflowRunId: process.env.GITHUB_RUN_ID || null,
    sourceSha,
    roots,
    files,
    ...totals,
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ status: 'WROTE', manifestPath, sourceSha, ...totals }, null, 2));
} else {
  if (!fs.existsSync(manifestPath)) throw new Error(`Missing Firebase prebuilt manifest: ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const failures = [];
  if (manifest.schemaVersion !== 'urai-jobs-firebase-prebuilt-1') failures.push('schema version');
  if (manifest.sourceSha !== sourceSha) failures.push('source SHA');
  if (JSON.stringify(manifest.roots) !== JSON.stringify(roots)) failures.push('output roots');
  if (JSON.stringify(manifest.files) !== JSON.stringify(files)) failures.push('file set, sizes, or hashes');
  if (manifest.fileCount !== totals.fileCount || manifest.totalBytes !== totals.totalBytes) failures.push('manifest totals');
  if (process.env.GITHUB_RUN_ID && manifest.workflowRunId !== process.env.GITHUB_RUN_ID) failures.push('workflow run ID');
  if (failures.length) throw new Error(`Firebase prebuilt verification failed: ${failures.join(', ')}`);
  console.log(JSON.stringify({ status: 'PASS', manifestPath, sourceSha, ...totals }, null, 2));
}
