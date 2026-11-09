#!/usr/bin/env node
/**
 * R946 fail-fast audit of all literal check_blob pins in the R879 review runner.
 * Uses the already pinned, local Git HEAD tree only. Read-only and offline.
 * This validates source closure; it is NOT emulator, cloud, or release evidence.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const runnerPath = process.argv[2] || 'scripts/run-r879-unified-native-acceptance.sh';
let contents;
try {
  contents = readFileSync(runnerPath, 'utf8');
} catch (error) {
  console.error('R946_SOURCE_PIN_HOLD runner_unavailable', error?.message || error);
  process.exit(2);
}
const matches = [...contents.matchAll(/^\s*check_blob\s+['"]([^'"\n]+)['"]\s+['"]([0-9a-f]{40})['"]\s*$/gm)];
if (matches.length === 0) {
  console.error('R946_SOURCE_PIN_HOLD no_literal_check_blob_pins');
  process.exit(2);
}
let output;
try {
  output = execFileSync('git', ['ls-tree', '-r', '--full-tree', 'HEAD'], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (error) {
  console.error('R946_SOURCE_PIN_HOLD git_head_tree_unavailable', error?.message || error);
  process.exit(2);
}
const blobs = new Map();
for (const line of output.split('\n')) {
  const match = /^\d{6} blob ([0-9a-f]{40})\t(.+)$/.exec(line);
  if (match) blobs.set(match[2], match[1]);
}
const seen = new Set();
let failures = 0;
for (const match of matches) {
  const [, path, expected] = match;
  const actual = blobs.get(path);
  if (seen.has(path)) {
    console.error('R946_SOURCE_PIN_HOLD duplicate_path', path);
    failures++;
  }
  seen.add(path);
  if (actual !== expected) {
    console.error('R946_SOURCE_PIN_HOLD blob_mismatch', path,
      'expected=' + expected, 'actual=' + (actual || 'MISSING'));
    failures++;
  }
}
if (failures) {
  console.error('R946_SOURCE_PIN_HOLD failures=' + failures + ' checked=' + matches.length);
  process.exit(1);
}
console.log('R946_SOURCE_PIN_PREFLIGHT_PASS count=' + matches.length + ' head=' +
  execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim());
