import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

function safeExec(command, fallback = '') {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return fallback;
  }
}

const outDir = 'docs/release-evidence';
fs.mkdirSync(outDir, { recursive: true });

const timestamp = new Date().toISOString();
const date = timestamp.slice(0, 10);
const gitSha = process.env.DEPLOY_GIT_SHA || process.env.GITHUB_SHA || safeExec('git rev-parse HEAD', 'unknown');
const branch = process.env.GITHUB_REF_NAME || safeExec('git branch --show-current', 'unknown');
const runId = process.env.DEPLOY_RUN_ID || process.env.GITHUB_RUN_ID || 'local';
const environment = process.env.DEPLOY_ENVIRONMENT || process.env.URAI_ENV || 'unknown';
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'unknown';
const hostingSite = process.env.FIREBASE_HOSTING_SITE || 'unknown';

const evidence = `# URAI Jobs Deployment Artifact Stamp - ${date}

- Timestamp: ${timestamp}
- Git SHA: ${gitSha}
- Branch: ${branch}
- Run ID: ${runId}
- Environment: ${environment}
- Firebase/GCP project: ${projectId}
- Firebase hosting site: ${hostingSite}

## Worker URLs

- Narrator: ${process.env.NARRATOR_WORKER_URL || 'unknown'}
- Asset: ${process.env.ASSET_WORKER_URL || 'unknown'}
- Spatial: ${process.env.SPATIAL_WORKER_URL || 'unknown'}
- Studio: ${process.env.STUDIO_WORKER_URL || 'unknown'}

## Verification requirements

- [ ] Build passed
- [ ] Typecheck passed
- [ ] Runtime verification passed
- [ ] Smoke verification passed
- [ ] Worker health verification passed
- [ ] Authenticated production smoke passed
- [ ] Rollback path confirmed
`;

const file = path.join(outDir, `${date}-deployment-artifact.md`);
fs.writeFileSync(file, evidence);
console.log(`[PASS] Deployment artifact written: ${file}`);
