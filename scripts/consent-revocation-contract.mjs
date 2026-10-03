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
const processQueueNow = read("functions/src/jobs/processQueueNow.ts");
const processQueueTick = read("functions/src/jobs/processQueueTick.ts");
const blocks = read("functions/src/privacy/consentBlocks.ts");
const endpoint = read("functions/src/privacy/consentRevocation.ts");
const index = read("functions/src/index.ts");

ok("shared Job contract includes consent context", shared.includes("JobConsentContext") && shared.includes("consent?: JobConsentContext"));
ok("createJob accepts canonical consent context", createJob.includes("decisionReceiptId") && createJob.includes("policyVersion") && createJob.includes("purpose"));
ok(
  "execution preserves canonical consent alongside plural contexts",
  executeJob.includes("...(isConsentContext(job.consent) ? [job.consent] : [])")
    && executeJob.includes("...(Array.isArray(job.consents) ? job.consents.filter(isConsentContext) : [])")
    && executeJob.includes("const seen = new Set<string>()")
);
ok(
  "private-source creation requires consent",
  createJob.includes("Private-source processing requires canonical consent context: purpose, policy version, and decision receipt.")
    && createJob.includes("jobType === 'memory.private-source.transcribe' || jobType === 'memory.private-source.index'")
    && createJob.includes("Captured Reality reconstruction requires exactly memory.storage and location.context consent receipts.")
);
ok("consent block collection exists", blocks.includes("jobConsentBlocks"));
ok("consent event receipts are replay-safe", blocks.includes("jobConsentEventReceipts") && endpoint.includes("transaction.get(receiptRef)") && endpoint.includes("transaction.create(receiptRef"));
ok("revocation endpoint only admits consent.revoked.v1", endpoint.includes("z.literal('consent.revoked.v1')"));
ok("revocation endpoint requires secret bearer auth", endpoint.includes("URAI_JOBS_PRIVACY_EVENT_TOKEN") && endpoint.includes("authorization"));
ok("revocation writes active block", endpoint.includes("active: true"));
ok("revocation returns integrity acknowledgement", endpoint.includes("integrityHash") && endpoint.includes("acknowledgement"));
ok(
  "LEASED to RUNNING path checks all consent blocks",
  executeJob.includes("jobConsentContexts(job)")
    && executeJob.includes("consentContexts.map((context) => transaction.get(consentBlockRef(job.ownerUid!, context.purpose)))")
    && executeJob.includes("reason: 'consent-revoked'")
);
ok(
  "revoked consent cancels job and queue",
  executeJob.includes("status: 'CANCELLED'")
    && executeJob.includes("Worker dispatch blocked because required consent was revoked.")
);
ok(
  "dispatch path rechecks consent immediately before worker call",
  executeJob.includes("dispatchConsentContexts = jobConsentContexts(job)")
    && executeJob.indexOf("Worker dispatch blocked because required consent was revoked.") < executeJob.indexOf("axios.post")
);
ok(
  "manual queue leasing checks canonical consent blocks before lease",
  processQueueNow.includes("jobConsentContexts(job)")
    && processQueueNow.includes("transaction.get(consentBlockRef(job.ownerUid!, context.purpose))")
    && processQueueNow.indexOf("transaction.get(consentBlockRef(job.ownerUid!, context.purpose))") < processQueueNow.indexOf("const newLease = createLease(workerId)")
    && processQueueNow.includes("outcome: 'consent-revoked'")
);
ok(
  "scheduled queue leasing checks canonical consent blocks before lease",
  processQueueTick.includes("jobConsentContexts(job)")
    && processQueueTick.includes("transaction.get(consentBlockRef(job.ownerUid!, context.purpose))")
    && processQueueTick.indexOf("transaction.get(consentBlockRef(job.ownerUid!, context.purpose))") < processQueueTick.indexOf("const newLease = createLease(tickWorkerId)")
    && processQueueTick.includes("Consent revoked for purpose")
);
ok("revocation endpoint is exported", index.includes("ingestConsentRevocation"));

if (failed) {
  throw new Error(`CONSENT_REVOCATION_CONTRACT ${failed} checks failed`);
}

console.log("[PASS] CONSENT_REVOCATION_CONTRACT");
