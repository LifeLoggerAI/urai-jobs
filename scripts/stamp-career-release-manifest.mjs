import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const EVIDENCE_DIR = process.env.CAREER_SMOKE_EVIDENCE_DIR || 'release-evidence';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || '';
const GCP_REGION = process.env.GCP_REGION || 'us-central1';
const CAREER_WORKER_URL = process.env.CAREER_WORKER_URL || '';
const HOSTING_URL = process.env.FIREBASE_HOSTING_URL || process.env.CAREER_LIVE_BASE_URL || '';

const routes = [
  '/',
  '/career-mirror',
  '/career-marketplace',
  '/career-automation',
  '/career-decision',
  '/career-passport',
  '/career-versions'
];

const careerJobTypes = [
  'career.profile.summarize',
  'career.fit.score',
  'career.document.parse',
  'career.document.tailor',
  'career.packet.generate',
  'career.followup.plan',
  'career.interview.prep',
  'career.offer.compare',
  'career.spatial.portal.generate',
  'career.passport.export'
];

function safeExec(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function ensureEvidenceDir() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

function markdownTable(values, header) {
  return [
    `| ${header} |`,
    '| --- |',
    ...values.map((value) => `| \`${value}\` |`)
  ].join('\n');
}

function main() {
  ensureEvidenceDir();
  const commitSha = process.env.GITHUB_SHA || safeExec('git', ['rev-parse', 'HEAD']);
  const branch = process.env.GITHUB_REF_NAME || safeExec('git', ['branch', '--show-current']);
  const generatedAt = new Date().toISOString();

  const manifest = {
    generatedAt,
    commitSha,
    branch,
    firebaseProjectId: FIREBASE_PROJECT_ID,
    gcpRegion: GCP_REGION,
    careerWorkerUrlConfigured: Boolean(CAREER_WORKER_URL),
    careerWorkerUrl: CAREER_WORKER_URL ? '[configured]' : '',
    hostingUrl: HOSTING_URL,
    routes,
    careerJobTypes,
    requiredEvidenceFiles: [
      'career-prod-smoke-<timestamp>.json',
      'career-prod-smoke-<timestamp>.md'
    ]
  };

  const jsonPath = path.join(EVIDENCE_DIR, 'career-release-manifest.json');
  fs.writeFileSync(jsonPath, JSON.stringify(manifest, null, 2));

  const mdPath = path.join(EVIDENCE_DIR, 'career-release-manifest.md');
  fs.writeFileSync(mdPath, `# URAI Jobs Career Release Manifest\n\n- Generated at: ${generatedAt}\n- Commit SHA: \`${commitSha}\`\n- Branch: \`${branch}\`\n- Firebase project: \`${FIREBASE_PROJECT_ID}\`\n- GCP region: \`${GCP_REGION}\`\n- Career worker URL configured: ${Boolean(CAREER_WORKER_URL)}\n- Hosting URL: ${HOSTING_URL || 'not provided'}\n\n## Required live routes\n\n${markdownTable(routes, 'Route')}\n\n## Required career job types\n\n${markdownTable(careerJobTypes, 'Career job type')}\n\n## Required release evidence files\n\n- \`career-prod-smoke-<timestamp>.json\`\n- \`career-prod-smoke-<timestamp>.md\`\n`);

  console.log(`[PASS] Wrote ${jsonPath}`);
  console.log(`[PASS] Wrote ${mdPath}`);
}

try {
  main();
} catch (error) {
  console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
