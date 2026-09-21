import fs from 'node:fs';

const createJob = fs.readFileSync('functions/src/jobs/createJob.ts', 'utf8');
let failed = 0;

function check(name, condition) {
  if (condition) console.log(`[PASS] ${name}`);
  else {
    failed += 1;
    console.error(`[FAIL] ${name}`);
  }
}

check(
  'communications jobs are identified explicitly',
  createJob.includes("return jobType.startsWith('communications.');")
);
check(
  'tenant identity comes from the authenticated server-side user record',
  createJob.includes('function userTenantId(user: unknown)') &&
    createJob.includes('const raw = userRecord(user).tenantId;')
);
check(
  'canonical Communications tenant id pattern is enforced server-side',
  createJob.includes("const COMMUNICATIONS_TENANT_ID_PATTERN = /^tenant_[a-zA-Z0-9_-]{6,64}$/;") &&
    createJob.includes('!COMMUNICATIONS_TENANT_ID_PATTERN.test(tenantId)') &&
    createJob.includes('Communications jobs require a canonical server-owned tenantId matching the Communications tenant contract.')
);
check(
  'communications jobs fail closed when authenticated user has no tenantId',
  createJob.includes('communicationsJob && !tenantId') &&
    createJob.includes('Communications jobs require a server-owned tenantId on the authenticated user record.')
);
check(
  'caller payload tenantId is never used as authoritative job tenant',
  !/payload(?:\.|\[['"]tenantId['"]\])/.test(createJob.match(/function userTenantId[\s\S]*?function hasJobCreatePermission/)?.[0] ?? '') &&
    !createJob.includes('tenantId: payload.tenantId')
);
check(
  'canonical Job persists only the derived tenantId',
  createJob.includes('...(tenantId ? { tenantId } : {})')
);
check(
  'communications idempotency fingerprint is tenant-bound',
  createJob.includes('const fingerprintPayload = communicationsJob') &&
    createJob.includes('{ payload, tenantId }') &&
    createJob.includes('buildRequestFingerprint(jobType, fingerprintPayload)')
);
check(
  'audit metadata records the derived tenantId',
  /metadata:\s*\{[\s\S]*?tenantId,[\s\S]*?payloadBytes/.test(createJob)
);

check(
  'only the governed communications.message.send job type is admitted',
  createJob.includes('/^communications\\.message\\.send$/') &&
    !createJob.includes('/^communications\\./,')
);
check(
  'communications payload is strict and excludes raw recipients and channel overrides',
  createJob.includes('const CommunicationsMessagePayloadSchema = z.object({') &&
    createJob.includes('recipientAddressHash: z.string().trim().regex(/^[A-Fa-f0-9]{64}$/)') &&
    createJob.includes("urgency: z.enum(['normal', 'urgent']).default('normal')") &&
    createJob.includes('}).strict();') &&
    createJob.includes('raw recipient addresses and channel overrides are rejected.')
);
check(
  'communications payload validation runs before job persistence',
  createJob.includes("if (jobType === 'communications.message.send')") &&
    createJob.includes('CommunicationsMessagePayloadSchema.safeParse(payload)')
);

if (failed > 0) {
  console.error(`[FAIL] COMMUNICATIONS_TENANT_AUTHORITY_CONTRACT ${failed} checks failed`);
  process.exit(1);
}

console.log('[PASS] COMMUNICATIONS_TENANT_AUTHORITY_CONTRACT');
