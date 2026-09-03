import { spawnSync } from 'node:child_process';

function run(label, args) {
  console.log(`[INFO] ${label}`);
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (result.error) {
    console.error(`[FAIL] ${label}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[FAIL] ${label} exited with status ${result.status}`);
    process.exit(result.status || 1);
  }
  console.log(`[PASS] ${label}`);
}

run('Validate career smoke evidence JSON', ['scripts/validate-career-smoke-evidence.mjs']);
run('Render career smoke Markdown report', ['scripts/render-career-smoke-report.mjs']);

console.log('[PASS] CAREER_RELEASE_EVIDENCE');
