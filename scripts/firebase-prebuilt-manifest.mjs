#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repositoryRoot = process.cwd();
const sourceRoot = path.resolve(process.env.URAI_FIREBASE_PREBUILT_ROOT || repositoryRoot);
const manifestRelativePath = 'docs/release-evidence/firebase-prebuilt-manifest.json';
const manifestPath = path.join(sourceRoot, manifestRelativePath);
const roots = ['packages/shared-types/dist', 'functions/lib', 'web/dist'];
const shaPattern = /^[0-9a-f]{40}$/;
const writeMode = process.argv.includes('--write');
const verifyMode = process.argv.includes('--verify');
const materializeMode = process.argv.includes('--materialize');
if ([writeMode, verifyMode, materializeMode].filter(Boolean).length !== 1) {
  throw new Error('Choose exactly one of --write, --verify, or --materialize.');
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function exactSourceSha() {
  const expected = String(process.env.DEPLOY_SOURCE_SHA || '').trim();
  const actual = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).trim();
  if (!shaPattern.test(expected) || expected !== actual) {
    throw new Error(`Firebase prebuilt source mismatch: expected=${expected || '<missing>'} actual=${actual}`);
  }
  return actual;
}

function collectFiles(baseRoot) {
  const files = [];
  for (const relativeRoot of roots) {
    const absoluteRoot = path.join(baseRoot, relativeRoot);
    if (!fs.existsSync(absoluteRoot) || !fs.statSync(absoluteRoot).isDirectory()) {
      throw new Error(`Missing Firebase prebuilt output directory: ${relativeRoot}`);
    }
    const pending = [absoluteRoot];
    while (pending.length) {
      const directory = pending.pop();
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        const relative = path.relative(baseRoot, absolute).split(path.sep).join('/');
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

function readAndVerifyManifest(baseRoot, sourceSha) {
  const candidatePath = path.join(baseRoot, manifestRelativePath);
  if (!fs.existsSync(candidatePath)) throw new Error(`Missing Firebase prebuilt manifest: ${candidatePath}`);
  const manifest = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
  const files = collectFiles(baseRoot);
  const totals = {
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.size, 0),
  };
  const failures = [];
  if (manifest.schemaVersion !== 'urai-jobs-firebase-prebuilt-1') failures.push('schema version');
  if (manifest.sourceSha !== sourceSha) failures.push('source SHA');
  if (manifest.repository !== (process.env.GITHUB_REPOSITORY || 'LifeLoggerAI/urai-jobs')) failures.push('repository');
  if (JSON.stringify(manifest.roots) !== JSON.stringify(roots)) failures.push('output roots');
  if (JSON.stringify(manifest.files) !== JSON.stringify(files)) failures.push('file set, sizes, or hashes');
  if (manifest.fileCount !== totals.fileCount || manifest.totalBytes !== totals.totalBytes) failures.push('manifest totals');
  if (process.env.GITHUB_RUN_ID && manifest.workflowRunId !== process.env.GITHUB_RUN_ID) failures.push('workflow run ID');
  if (failures.length) throw new Error(`Firebase prebuilt verification failed: ${failures.join(', ')}`);
  return { manifest, files, totals, manifestPath: candidatePath };
}

function copyDirectory(source, destination) {
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) throw new Error(`Refusing to materialize symlink: ${source}`);
  if (stat.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true });
    for (const entry of fs.readdirSync(source)) copyDirectory(path.join(source, entry), path.join(destination, entry));
    return;
  }
  if (!stat.isFile()) throw new Error(`Unsupported materialization source: ${source}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
}

const sourceSha = exactSourceSha();

if (writeMode) {
  if (sourceRoot !== repositoryRoot) throw new Error('--write must run from the repository output root.');
  const files = collectFiles(repositoryRoot);
  const totals = {
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.size, 0),
  };
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
} else if (verifyMode) {
  const verified = readAndVerifyManifest(sourceRoot, sourceSha);
  console.log(JSON.stringify({ status: 'PASS', manifestPath: verified.manifestPath, sourceRoot, sourceSha, ...verified.totals }, null, 2));
} else {
  if (sourceRoot === repositoryRoot) throw new Error('--materialize requires URAI_FIREBASE_PREBUILT_ROOT outside the repository.');
  const verified = readAndVerifyManifest(sourceRoot, sourceSha);
  for (const relativeRoot of roots) {
    const destination = path.join(repositoryRoot, relativeRoot);
    fs.rmSync(destination, { recursive: true, force: true });
    copyDirectory(path.join(sourceRoot, relativeRoot), destination);
  }
  const destinationManifest = path.join(repositoryRoot, manifestRelativePath);
  fs.mkdirSync(path.dirname(destinationManifest), { recursive: true });
  fs.rmSync(destinationManifest, { force: true });
  fs.copyFileSync(verified.manifestPath, destinationManifest, fs.constants.COPYFILE_EXCL);
  const materialized = readAndVerifyManifest(repositoryRoot, sourceSha);
  console.log(JSON.stringify({ status: 'MATERIALIZED', sourceRoot, destinationRoot: repositoryRoot, sourceSha, ...materialized.totals }, null, 2));
}
