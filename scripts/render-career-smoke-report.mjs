import fs from 'node:fs';
import path from 'node:path';

const EVIDENCE_DIR = process.env.CAREER_SMOKE_EVIDENCE_DIR || 'release-evidence';
const EVIDENCE_FILE = process.env.CAREER_SMOKE_EVIDENCE_FILE;
const OUTPUT_FILE = process.env.CAREER_SMOKE_REPORT_FILE;

function getLatestEvidenceFile() {
  if (EVIDENCE_FILE) return EVIDENCE_FILE;
  if (!fs.existsSync(EVIDENCE_DIR)) {
    throw new Error(`Evidence directory not found: ${EVIDENCE_DIR}.`);
  }

  const files = fs.readdirSync(EVIDENCE_DIR)
    .filter((file) => /^career-prod-smoke-.*\.json$/.test(file))
    .map((file) => path.join(EVIDENCE_DIR, file))
    .map((filePath) => ({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (!files.length) throw new Error(`No career-prod-smoke JSON files found in ${EVIDENCE_DIR}.`);
  return files[0].filePath;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function statusFromResult(statusResult) {
  const job = statusResult?.job || statusResult;
  return job?.status || job?.jobStatus || job?.queueStatus || 'unknown';
}

function renderReport(evidence, sourceFile) {
  const rows = (evidence.smokeCases || [])
    .map((item) => `| ${escapeCell(item.version)} | \`${escapeCell(item.jobType)}\` | \`${escapeCell(item.jobId)}\` | ${escapeCell(statusFromResult(item.statusResult))} | \`${escapeCell(item.outputPrefix)}\` |`)
    .join('\n');

  return `# URAI Jobs Career Smoke Report\n\nGenerated from: \`${sourceFile}\`\n\n## Run identity\n\n- Project: ${evidence.projectId || ''}\n- Region: ${evidence.region || ''}\n- Created at: ${evidence.createdAt || ''}\n- Worker env required: \`${evidence.workerUrlEnvRequired || 'CAREER_WORKER_URL'}\`\n\n## V1-V5 smoke job IDs\n\n| Version | Career job type | Job ID | Current status | Output prefix |\n| --- | --- | --- | --- | --- |\n${rows}\n\n## Release checklist\n\n- [ ] All ten job IDs are present.\n- [ ] All five versions are represented.\n- [ ] Worker health checked after smoke run.\n- [ ] Terminal statuses checked in Firebase/Firestore.\n- [ ] Artifacts checked in storage or result outputs.\n- [ ] Report attached to production validation record.\n`;
}

function main() {
  const evidenceFile = getLatestEvidenceFile();
  const evidence = readJson(evidenceFile);
  const outputFile = OUTPUT_FILE || evidenceFile.replace(/\.json$/, '.md');
  const report = renderReport(evidence, evidenceFile);
  fs.writeFileSync(outputFile, report);
  console.log(`[PASS] Wrote career smoke Markdown report: ${outputFile}`);
}

try {
  main();
} catch (error) {
  console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
