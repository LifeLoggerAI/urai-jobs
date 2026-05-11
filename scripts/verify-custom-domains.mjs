const domains = process.argv.slice(2);
const expected = domains.length ? domains : ["https://uraijobs.com", "https://www.uraijobs.com", "https://urai-jobs.web.app"];

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

if (failed) process.exit(1);
console.log("[PASS] Domain verification complete.");
