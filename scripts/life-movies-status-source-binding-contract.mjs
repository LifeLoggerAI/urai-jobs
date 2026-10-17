import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../functions/src/jobs/studioLifeMovieLongformBridge.ts',import.meta.url),'utf8');
const start=source.indexOf('async function readPlanStatus(');
const end=source.indexOf('\nasync function assemblePlan(',start);
assert.ok(start>=0 && end>start);
const status=source.slice(start,end);
for(const marker of [
  "const plan = await loadPlan(planId, tenantId, userId)",
  "sourceSystem: plan.sourceSystem",
  "ownerUid: plan.ownerUid",
  "tenantId: plan.tenantId",
  "projectId: plan.projectId",
  "sceneTruthReceiptRef: plan.sceneTruthReceiptRef",
  "sceneTruthDigest: plan.sceneTruthDigest",
  "renderPlanDigest: plan.renderPlanDigest",
  "processingPurpose: plan.consent.purpose",
  "data?.ownerUid",
  "validJob(data, plan.childJobIds[index]",
  "longform_plan_boundary_mismatch",
  "consentRevoked: revoked",
  "['REVOKED', 'DELETED']",
]) {
  assert.ok(status.includes(marker) || (marker==="data?.ownerUid" && status.includes("value?.ownerUid === userId")),
    'Missing Jobs status owner-source guard: '+marker);
}
assert.ok(status.indexOf("if (data && !validJob(")<status.indexOf("return {\n    planId,\n    // Owner-scoped attestation"),
  'Foreign child source must fail before status attestation');
assert.ok(!status.includes('publicReleaseAuthorized: true'));
console.log('[PASS] Jobs longform status checks trusted plan/child owner/tenant/receipt linkage; static source regression, not cloud acceptance');
