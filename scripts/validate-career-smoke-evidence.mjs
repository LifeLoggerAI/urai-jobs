import fs from 'node:fs';
import path from 'node:path';

const EVIDENCE_DIR = process.env.CAREER_SMOKE_EVIDENCE_DIR || 'release-evidence';
const EVIDENCE_FILE = process.env.CAREER_SMOKE_EVIDENCE_FILE;

const requiredCases = [
  ['V1', 'career.profile.summarize'],
  ['V1', 'career.fit.score'],
  ['V2', 'career.document.parse'],
  ['V2', 'career.document.tailor'],
  ['V2', 'career.packet.generate'],
  ['V3', 'career.followup.plan'],
  ['V4', 'career.interview.prep'],
  ['V4', 'career.offer.compare'],
  ['V4', 'career.spatial.portal.generate'],
  ['V5', 'career.passport.export'],
];

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`[PASS] ${message}`);
}

function getLatestEvidenceFile() {
  if (EVIDENCE_FILE) return EVIDENCE_FILE;
  if (!fs.existsSync(EVIDENCE_DIR)) {
    throw new Error(`Evidence directory not found: ${EVIDENCE_DIR}. Set CAREER_SMOKE_EVIDENCE_FILE to a specific JSON file.`);
  }

  const files = fs.readdirSync(EVIDENCE_DIR)
    .filter((file) => /^career-prod-smoke-.*\.json$/.test(file))
    .map((file) => path.join(EVIDENCE_DIR, file))
    .map((filePath) => ({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (!files.length) {
    throw new Error(`No career-prod-smoke JSON files found in ${EVIDENCE_DIR}.`);
  }

  return files[0].filePath;
}

function readEvidence(filePath) {
  const body = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function normalizeCase(item) {
  return `${item.version}:${item.jobType}`;
}

function main() {
  const filePath = getLatestEvidenceFile();
  const evidence = readEvidence(filePath);
  const smokeCases = Array.isArray(evidence.smokeCases) ? evidence.smokeCases : [];
  const found = new Set(smokeCases.map(normalizeCase));
  const versions = new Set(smokeCases.map((item) => item.version));

  pass(`Loaded career smoke evidence: ${filePath}`);

  if (!evidence.projectId) fail('Evidence is missing projectId.'); else pass(`Evidence projectId: ${evidence.projectId}`);
  if (!evidence.region) fail('Evidence is missing region.'); else pass(`Evidence region: ${evidence.region}`);
  if (!evidence.createdAt) fail('Evidence is missing createdAt.'); else pass(`Evidence createdAt: ${evidence.createdAt}`);
  if (evidence.workerUrlEnvRequired !== 'CAREER_WORKER_URL') fail('Evidence must record CAREER_WORKER_URL requirement.'); else pass('Evidence records CAREER_WORKER_URL requirement.');

  requiredCases.forEach(([version, jobType]) => {
    const key = `${version}:${jobType}`;
    if (!found.has(key)) fail(`Missing required smoke case ${key}.`); else pass(`Found ${key}.`);
  });

  ['V1', 'V2', 'V3', 'V4', 'V5'].forEach((version) => {
    if (!versions.has(version)) fail(`Missing version coverage ${version}.`); else pass(`Version coverage present: ${version}.`);
  });

  if (smokeCases.length !== requiredCases.length) {
    fail(`Expected exactly ${requiredCases.length} smoke cases, found ${smokeCases.length}.`);
  } else {
    pass(`Smoke case count is ${smokeCases.length}.`);
  }

  smokeCases.forEach((item) => {
    const label = normalizeCase(item);
    if (!item.jobId || typeof item.jobId !== 'string') fail(`${label} is missing jobId.`); else pass(`${label} has jobId ${item.jobId}.`);
    if (!item.outputPrefix || typeof item.outputPrefix !== 'string') fail(`${label} is missing outputPrefix.`); else pass(`${label} has outputPrefix.`);
    if (!item.statusResult) fail(`${label} is missing statusResult.`); else pass(`${label} has statusResult.`);
  });

  if (process.exitCode) {
    throw new Error('CAREER_SMOKE_EVIDENCE_VALIDATE failed.');
  }

  console.log('[PASS] CAREER_SMOKE_EVIDENCE_VALIDATE');
}

try {
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
  process.exit(process.exitCode || 1);
}
