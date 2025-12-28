import fs from "node:fs/promises";

const GH_REPO = process.env.GH_REPO;      // e.g. "geturai/urai-analytics"
const GH_TOKEN = process.env.GH_TOKEN;    // GitHub token with Issues: write
const DRY_RUN = process.env.DRY_RUN === "1";

const inputPath = process.argv[2] || "scripts/issues.json";

function die(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

if (!GH_REPO) die("Missing GH_REPO. Example: export GH_REPO=geturai/urai-analytics");
if (!GH_TOKEN) die("Missing GH_TOKEN. Example: export GH_TOKEN=ghp_xxx (needs Issues: write)");

const BASE = "https://api.github.com";
const headers = {
  "Accept": "application/vnd.github+json",
  "Authorization": `Bearer ${GH_TOKEN}`,
  "X-GitHub-Api-Version": "2022-11-28",
};

async function gh(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) {
    console.error("GitHub API error:", res.status, json);
    throw new Error(`GitHub API failed: ${res.status}`);
  }
  return json;
}

async function listOpenIssueTitles(owner, repo) {
  const titles = new Set();
  let page = 1;
  while (true) {
    const issues = await gh(`/repos/${owner}/${repo}/issues?state=open&per_page=100&page=${page}`);
    if (!Array.isArray(issues) || issues.length === 0) break;
    for (const it of issues) {
      // GitHub includes PRs in /issues; PRs have pull_request key
      if (!it.pull_request && it.title) titles.add(it.title.trim());
    }
    if (issues.length < 100) break;
    page++;
  }
  return titles;
}

async function main() {
  const [owner, repo] = GH_REPO.split("/");
  if (!owner || !repo) die(`GH_REPO must look like "owner/repo". Got: ${GH_REPO}`);

  const raw = await fs.readFile(inputPath, "utf8").catch(() => null);
  if (!raw) die(`Couldn't read ${inputPath}. Create it (example below).`);

  let issues;
  try { issues = JSON.parse(raw); } catch { die(`${inputPath} must be valid JSON.`); }
  if (!Array.isArray(issues)) die(`${inputPath} must be an array of issues.`);

  console.log(`\nRepo: ${GH_REPO}`);
  console.log(`Input: ${inputPath}`);
  console.log(`Mode: ${DRY_RUN ? "DRY_RUN (no changes)" : "LIVE (will create issues)"}\n`);

  const existingTitles = await listOpenIssueTitles(owner, repo);

  let created = 0, skipped = 0;
  for (const item of issues) {
    const title = (item.title || "").trim();
    if (!title) { skipped++; continue; }

    if (existingTitles.has(title)) {
      console.log(`↩️  Skip (already exists): ${title}`);
      skipped++;
      continue;
    }

    const body = item.body || "";
    const payload = {
      title,
      body,
      labels: Array.isArray(item.labels) ? item.labels : undefined,
      assignees: Array.isArray(item.assignees) ? item.assignees : undefined,
      milestone: typeof item.milestone === "number" ? item.milestone : undefined,
    };

    if (DRY_RUN) {
      console.log(`🧪 Would create: ${title}`);
      created++;
      continue;
    }

    const out = await gh(`/repos/${owner}/${repo}/issues`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    console.log(`✅ Created: ${out.title} -> #${out.number}`);
    created++;
    existingTitles.add(title);
  }

  console.log(`\nDone. Created: ${created} | Skipped: ${skipped}\n`);
}

main().catch((e) => {
  console.error("\n❌ Failed:", e?.message || e);
  process.exit(1);
});
