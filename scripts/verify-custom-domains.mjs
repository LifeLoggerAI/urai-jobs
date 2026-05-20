import dns from "dns/promises";
import fs from "fs";

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
const projectId = firebaserc?.projects?.default || firebaserc?.projects?.prod || "";
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
  try {
    const response = await fetch(url, { method: "GET", redirect: "follow" });
    const text = await response.text();
    const assetMatch = text.match(/index-[A-Za-z0-9_-]+\.js/);
    return {
      url,
      hostname: hostnameFromUrl(url),
      ok: response.ok,
      status: response.status,
      ms: Date.now() - started,
      asset: assetMatch?.[0] || null,
      hasAppShell: text.includes("/assets/") || text.includes("URAI Jobs")
    };
  } catch (error) {
    return {
      url,
      hostname: hostnameFromUrl(url),
      ok: false,
      status: 0,
      ms: Date.now() - started,
      asset: null,
      hasAppShell: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

const results = await Promise.all(expected.map(check));
let failed = false;
const failedCustomHosts = new Set();

for (const result of results) {
  const prefix = result.ok && result.hasAppShell ? "[PASS]" : "[FAIL]";
  console.log(`${prefix} ${result.url} status=${result.status} ms=${result.ms} asset=${result.asset || "none"}`);
  if (result.error) console.log(`  error=${result.error}`);
  if (!result.ok || !result.hasAppShell) {
    failed = true;
    if (isCustomUraiDomain(result.hostname)) failedCustomHosts.add(result.hostname);
  }
}

if (failedCustomHosts.size) {
  console.log("[INFO] Custom domain DNS diagnostics:");
  for (const hostname of failedCustomHosts) {
    const records = await resolveRecords(hostname);
    printDnsGuidance(hostname, records, hostingSite);
  }
}

const passingCanonical = results.filter((result) => result.ok && result.hasAppShell).map((result) => result.url);
if (passingCanonical.length) console.log(`[INFO] Passing app-shell domain(s): ${passingCanonical.join(", ")}`);
if (failed) {
  console.error("[FAIL] One or more domains did not serve the expected URAI Jobs app shell.");
  console.error("Check Firebase Hosting custom domain attachment, DNS records, SSL provisioning, and whether apex/www point to the hosting site in firebase.json.");
  console.error(`Expected Firebase Hosting site: ${hostingSite || "unknown"}`);
  process.exit(1);
}
console.log("[PASS] Domain verification complete.");
