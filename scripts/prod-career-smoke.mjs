const blockedReason = [
  'Career production smoke is intentionally blocked on this branch before any production auth/user/firestore work can run.',
  'Current product boundary: URAI Jobs is an internal worker-infrastructure preview, not production career worker execution.',
  'Only narrator.tts is allowlisted for createJob on this branch.',
  'Career job types are intentionally gated and the career worker returns NOT_IMPLEMENTED until real execution and lifecycle proof exist.',
  'Use production smoke only after explicit operator approval, a deployed implementation, and updated allowlist/contracts/proof artifacts.'
];

for (const line of blockedReason) console.error(`[BLOCKED] ${line}`);

throw new Error('CAREER_PROD_SMOKE_BLOCKED_UNTIL_IMPLEMENTED');
