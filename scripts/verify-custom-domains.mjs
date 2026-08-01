import dns from "dns/promises";
import fs from "fs";

const SHA_PATTERN = /^[0-9a-f]{40}$/;

function readJson(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

async function resolveRecords(hostname) {
  const records = { a: [], aaaa: [], cname: [] };
  try {
    records.a = await dns.resolve4(hostname);
  } catch {}
  try {
    records.aaaa = await dns.resolve6(hostname);
  } catch {}
  try {
    records.cname = await dns.resolveCname(hostname);
  } catch {}
  return records;
}

function isCustomUraiDomain(hostname) {
  return hostname === "uraijobs.com" || hostname === "www.uraijobs.com";
}

function printDnsGuidance(hostname, records, hostingSite) {
  console.log(`[INFO] DNS ${hostname}`);
  console.log(`  A: ${records.a.length ? records.a.join(", ") : "none"}`);
  console.log(`  AAAA: ${records.aaaa.length ? records.aaaa.join(", ") : "none"}`);
  console.log(`  CNAME: ${records.cname.length ? records.cname.join(", ") : "none"}`);

  if (hostname === "uraijobs.com") {
    console.log("  Expected Firebase Hosting apex A: 199.36.158.100");
  }

  if (hostname === "www.uraijobs.com") {
    console.log(`  Expected www target: attach www.uraijobs.com to Firebase Hosting site ${hostingSite || "<unknown>"} and use the DNS record Firebase provides.`);
  }
}

const firebaseJson = readJson("firebase.json");
const firebaserc = readJson(".firebaserc");
const hostingSite = typeof firebaseJson?.hosting?.site === "string" ? firebaseJson.hosting.site : "";
const projectId = process.env.FIREBASE_PROJECT_ID || firebaserc?.projects?.default || firebaserc?.projects?.prod || "";
const expectedSha = String(process.env.TARGET_SHA || process.env.DEPLOY_SOURCE_SHA || "").trim();
const expectedEnvironment = String(process.env.INPUT_TARGET || process.env.URAI_ENV || "").trim();

if (!SHA_PATTERN.test(expectedSha)) {
  throw new Error("Public verification requires TARGET_SHA or DEPLOY_SOURCE_SHA as an exact lowercase 40-character SHA.");
}
if (!projectId) throw new Error("Public verification requires FIREBASE_PROJECT_ID or a configured Firebase project.");
if (!expectedEnvironment) throw new Error("Public verification requires INPUT_TARGET or URAI_ENV.");

const domains = process.argv
  .slice(2)
  .filter((arg) => arg && arg !== "--")
  .filter((arg) => /^https?:\/\//i.test(arg));
const defaultDomains = [
  "https://uraijobs.com",
  "https://www.uraijobs.com",
  hostingSite ? `https://${hostingSite}.web.app` : "",
  projectId ? `https://${projectId}.web.app` : ""
].filter(Boolean);
const expected = domains.length ? domains : [...new Set(defaultDomains)];

async function check(url) {
  const started = Date.now();
  const base = url.replace(/\/$/, "");
  try {
    const [appResponse, buildResponse] = await Promise.all([
      fetch(base, { method: "GET", redirect: "follow", cache: "no-store" }),
      fetch(`${base}/api/buildinfo`, {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        headers: { accept: "application/json" },
      }),
    ]);
    const text = await appResponse.text();
    const buildText = await buildResponse.text();
    let buildInfo = null;
    try {
      buildInfo = JSON.parse(buildText);
    } catch {}
    const assetMatch = text.match(/index-[A-Za-z0-9_-]+\.js/);
    const identityMatches =
      buildResponse.ok &&
      buildInfo?.schemaVersion === "urai-jobs-build-info-1" &&
      buildInfo?.status === "ok" &&
      buildInfo?.sourceSha === expectedSha &&
      buildInfo?.environment === expectedEnvironment &&
      buildInfo?.projectId === projectId;
    return {
      url: base,
      hostname: hostnameFromUrl(base),
      ok: appResponse.ok,
      status: appResponse.status,
      ms: Date.now() - started,
      asset: assetMatch?.[0] || null,
      hasAppShell: text.includes("/assets/") || text.includes("URAI Jobs"),
      buildStatus: buildResponse.status,
      buildInfo,
      identityMatches,
    };
  } catch (error) {
    return {
      url: base,
      hostname: hostnameFromUrl(base),
      ok: false,
      status: 0,
      ms: Date.now() - started,
      asset: null,
      hasAppShell: false,
      buildStatus: 0,
      buildInfo: null,
      identityMatches: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

const results = await Promise.all(expected.map(check));
let failed = false;
const failedCustomHosts = new Set();

for (const result of results) {
  const passed = result.ok && result.hasAppShell && result.identityMatches;
  const prefix = passed ? "[PASS]" : "[FAIL]";
  console.log(`${prefix} ${result.url} status=${result.status} ms=${result.ms} asset=${result.asset || "none"} buildStatus=${result.buildStatus} runtimeSha=${result.buildInfo?.sourceSha || "none"}`);
  if (result.error) console.log(`  error=${result.error}`);
  if (!passed) {
    failed = true;
    if (isCustomUraiDomain(result.hostname)) failedCustomHosts.add(result.hostname);
    if (!result.identityMatches) {
      console.log(`  expectedIdentity=${JSON.stringify({ sourceSha: expectedSha, environment: expectedEnvironment, projectId })}`);
      console.log(`  observedIdentity=${JSON.stringify(result.buildInfo)}`);
    }
  }
}

if (failedCustomHosts.size) {
  console.log("[INFO] Custom domain DNS diagnostics:");
  for (const hostname of failedCustomHosts) {
    const records = await resolveRecords(hostname);
    printDnsGuidance(hostname, records, hostingSite);
  }
}

const passingCanonical = results
  .filter((result) => result.ok && result.hasAppShell && result.identityMatches)
  .map((result) => result.url);
if (passingCanonical.length) console.log(`[INFO] Passing exact-runtime domain(s): ${passingCanonical.join(", ")}`);
if (failed) {
  console.error("[FAIL] One or more domains did not serve the expected URAI Jobs app shell and exact Firebase runtime identity.");
  console.error("Check Firebase Hosting attachment, DNS, SSL, buildInfo rewrite, deployed Functions environment, and exact source SHA.");
  console.error(`Expected Firebase Hosting site: ${hostingSite || "unknown"}`);
  process.exit(1);
}
console.log(`[PASS] Domain and Firebase runtime verification complete for ${expectedSha}.`);
