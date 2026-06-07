import fs from 'node:fs';
import path from 'node:path';

const EVIDENCE_DIR = process.env.CAREER_SMOKE_EVIDENCE_DIR || 'release-evidence';
const BASE_URL = process.env.CAREER_LIVE_BASE_URL || process.env.FIREBASE_HOSTING_URL || process.env.PUBLIC_BASE_URL || '';

const routes = [
  { version: 'HOME', label: 'URAI Jobs Home', path: '/' },
  { version: 'V1', label: 'Career Mirror', path: '/career-mirror' },
  { version: 'V2', label: 'Marketplace', path: '/career-marketplace' },
  { version: 'V3', label: 'Automation Controls', path: '/career-automation' },
  { version: 'V4', label: 'Decision Layer', path: '/career-decision' },
  { version: 'V5', label: 'Passport', path: '/career-passport' },
  { version: 'CONSOLE', label: 'Version Console', path: '/career-versions' }
];

function ensureDir() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

function routeUrl(routePath) {
  if (!BASE_URL) return '';
  return `${BASE_URL.replace(/\/$/, '')}${routePath}`;
}

function main() {
  ensureDir();
  const generatedAt = new Date().toISOString();
  const checklist = {
    generatedAt,
    baseUrl: BASE_URL,
    routes: routes.map((route) => ({
      ...route,
      url: routeUrl(route.path),
      verified: false,
      notes: ''
    }))
  };

  const jsonPath = path.join(EVIDENCE_DIR, 'career-live-route-checklist.json');
  fs.writeFileSync(jsonPath, JSON.stringify(checklist, null, 2));

  const rows = checklist.routes
    .map((route) => `| ${route.version} | ${route.label} | \`${route.path}\` | ${route.url || 'base URL not provided'} |  |`)
    .join('\n');

  const mdPath = path.join(EVIDENCE_DIR, 'career-live-route-checklist.md');
  fs.writeFileSync(mdPath, `# URAI Jobs Live Route Checklist\n\nGenerated at: ${generatedAt}\n\nBase URL: ${BASE_URL || 'not provided'}\n\n| Version | Surface | Path | URL | Verified |\n| --- | --- | --- | --- | --- |\n${rows}\n\n## Verification instructions\n\n- Open each URL after Firebase Hosting deploy.\n- Confirm the URAI Jobs shell loads.\n- Confirm the visible page matches the expected surface.\n- Mark each row verified in the production validation document.\n`);

  console.log(`[PASS] Wrote ${jsonPath}`);
  console.log(`[PASS] Wrote ${mdPath}`);
}

try {
  main();
} catch (error) {
  console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
