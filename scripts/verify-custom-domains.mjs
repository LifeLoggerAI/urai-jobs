import fs from "fs";

function readJson(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
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
      ok: response.ok,
      status: response.status,
      ms: Date.now() - started,
      asset: assetMatch?.[0] || null,
      hasAppShell: text.includes("/assets/") || text.includes("URAI Jobs")
    };
  } catch (error) {
    return {
      url,
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

for (const result of results) {
  const prefix = result.ok && result.hasAppShell ? "[PASS]" : "[FAIL]";
  console.log(`${prefix} ${result.url} status=${result.status} ms=${result.ms} asset=${result.asset || "none"}`);
  if (result.error) console.log(`  error=${result.error}`);
  if (!result.ok || !result.hasAppShell) failed = true;
}

const passingCanonical = results.filter((result) => result.ok && result.hasAppShell).map((result) => result.url);
if (passingCanonical.length) console.log(`[INFO] Passing app-shell domain(s): ${passingCanonical.join(", ")}`);
if (failed) {
  console.error("[FAIL] One or more domains did not serve the expected URAI Jobs app shell.");
  console.error("Check Firebase Hosting custom domain attachment, DNS records, SSL provisioning, and whether apex/www point to the hosting site in firebase.json.");
  process.exit(1);
}
console.log("[PASS] Domain verification complete.");
