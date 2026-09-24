import fs from "fs";

let failed = 0;
const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "");
const ok = (name, condition) => {
  if (condition) console.log(`[PASS] ${name}`);
  else {
    failed += 1;
    console.error(`[FAIL] ${name}`);
  }
};

const shared = read("packages/shared-types/src/index.ts");
const createJob = read("functions/src/jobs/createJob.ts");
const executeJob = read("functions/src/jobs/executeJob.ts");
const blocks = read("functions/src/privacy/consentBlocks.ts");
const endpoint = read("functions/src/privacy/consentRevocation.ts");
const index = read("functions/src/index.ts");

ok("shared Job contract includes consent context", shared.includes("JobConsentContext") && shared.includes("consent?: JobConsentContext"));
ok("createJob accepts canonical consent context", createJob.includes("decisionReceiptId") && createJob.includes("policyVersion") && createJob.includes("purpose"));
ok("private-source creation requires consent", createJob.includes("Private-source jobs require canonical consent context"));
ok("consent block collection exists", blocks.includes("jobConsentBlocks"));
ok("consent event receipts are replay-safe", blocks.includes("jobConsentEventReceipts") && endpoint.includes("transaction.get(receiptRef)") && endpoint.includes("transaction.create(receiptRef"));
ok("revocation endpoint only admits consent.revoked.v1", endpoint.includes("z.literal('consent.revoked.v1')"));
ok("revocation endpoint requires secret bearer auth", endpoint.includes("URAI_JOBS_PRIVACY_EVENT_TOKEN") && endpoint.includes("authorization"));
ok("revocation writes active block", endpoint.includes("active: true"));
ok("revocation returns integrity acknowledgement", endpoint.includes("integrityHash") && endpoint.includes("acknowledgement"));
ok("LEASED to RUNNING path checks consent block", executeJob.includes("consentBlockRef(job.ownerUid, job.consent.purpose)") && executeJob.includes("reason: 'consent-revoked'"));
ok("revoked consent cancels job and queue", executeJob.includes("status: 'CANCELLED'") && executeJob.includes("Worker dispatch blocked because consent was revoked."));
ok("dispatch path rechecks consent immediately before worker call", executeJob.indexOf("Worker dispatch blocked because consent was revoked.") < executeJob.indexOf("axios.post"));
ok("revocation endpoint is exported", index.includes("ingestConsentRevocation"));

if (failed) {
  throw new Error(`CONSENT_REVOCATION_CONTRACT ${failed} checks failed`);
}

console.log("[PASS] CONSENT_REVOCATION_CONTRACT");
