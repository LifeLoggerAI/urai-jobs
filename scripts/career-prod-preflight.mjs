const blockedReason = [
  'Career production preflight is intentionally blocked on this branch.',
  'Current product boundary: URAI Jobs is an internal worker-infrastructure preview, not production career worker execution.',
  'Only narrator.tts is allowlisted for createJob on this branch.',
  'The career worker intentionally returns NOT_IMPLEMENTED until real execution and lifecycle proof exist.',
  'Do not run career production smoke or touch production career smoke users until career job types are re-allowlisted with proof.'
];

for (const line of blockedReason) console.error(`[BLOCKED] ${line}`);

throw new Error('CAREER_PROD_PREFLIGHT_BLOCKED_UNTIL_IMPLEMENTED');
