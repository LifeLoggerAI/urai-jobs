import fs from 'node:fs';

const requiredFiles = [
  '.github/workflows/career-production-release.yml',
  '.github/workflows/career-surfaces-ci.yml',
  '.github/workflows/urai-jobs-runtime-ci.yml',
  'docs/CAREER_PRODUCTION_RELEASE_RUNBOOK.md',
  'docs/LIVE_DEPLOYMENT_BLOCKERS.md',
  'docs/RELEASE_EVIDENCE_TEMPLATE.md',
  'docs/URAI_JOBS_V1_V5_COMPLETION_MATRIX.md',
  'scripts/career-prod-preflight.mjs',
  'scripts/career-runtime-smoke.mjs',
  'scripts/prod-career-smoke.mjs',
  'scripts/validate-career-smoke-evidence.mjs',
  'scripts/render-career-smoke-report.mjs',
  'scripts/stamp-career-release-manifest.mjs',
  'scripts/stamp-career-route-checklist.mjs',
  'web/src/lib/careerRoutes.ts'
];

const requiredWorkflowTerms = [
  'deploy_before_smoke',
  'live_base_url',
  'career_worker_url',
  'pnpm prod:career-preflight',
  'pnpm deploy:firebase:prod',
  'pnpm deploy:workers',
  'pnpm prod:verify-workers',
  'pnpm prod:career-smoke',
  'pnpm prod:career-release-evidence',
  'stamp-career-release-manifest.mjs',
  'stamp-career-route-checklist.mjs',
  'actions/upload-artifact'
];

const requiredEvidenceTerms = [
  'career-prod-smoke-<timestamp>.json',
  'career-prod-smoke-<timestamp>.md',
  'career-release-manifest.json',
  'career-release-manifest.md',
  'career-live-route-checklist.json',
  'career-live-route-checklist.md'
];

let failed = 0;

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function ok(name, condition) {
  if (condition) {
    console.log(`[PASS] ${name}`);
  } else {
    failed += 1;
    console.error(`[FAIL] ${name}`);
  }
}

requiredFiles.forEach((file) => ok(`required file exists: ${file}`, fs.existsSync(file)));

const productionWorkflow = read('.github/workflows/career-production-release.yml');
requiredWorkflowTerms.forEach((term) => ok(`production workflow includes ${term}`, productionWorkflow.includes(term)));

const releaseTemplate = read('docs/RELEASE_EVIDENCE_TEMPLATE.md');
const runbook = read('docs/CAREER_PRODUCTION_RELEASE_RUNBOOK.md');
requiredEvidenceTerms.forEach((term) => {
  ok(`release template or runbook documents ${term}`, releaseTemplate.includes(term) || runbook.includes(term));
});

const routeManifest = read('web/src/lib/careerRoutes.ts');
['/career-mirror', '/career-marketplace', '/career-automation', '/career-decision', '/career-passport', '/career-versions'].forEach((route) => {
  ok(`route manifest includes ${route}`, routeManifest.includes(route));
});

if (failed) {
  throw new Error(`CAREER_LAUNCH_GATE ${failed} checks failed`);
}

console.log('[PASS] CAREER_LAUNCH_GATE');
