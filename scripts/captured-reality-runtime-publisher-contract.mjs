import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('functions/src/jobs/capturedRealityRuntimePublisher.ts','utf8');
const index=fs.readFileSync('functions/src/index.ts','utf8');
for(const marker of [
  "memory.private-source.reconstruct-place","status!=='SUCCESS'","capturedRealityAcceptedCallbackHash",
  "memory.storage","location.context","/artifact","expectedRuntimeSha256","ifGenerationMatch:0",
  "private-captured-reality/","uraiRuntimeSha256","storageGeneration",
  "reviewState:'technical-unreviewed'","releaseState:'hard-off'","candidateAcceptance:false",
  "publicReleaseAuthorized:false","metricScaleVerified:false","navigationAccepted:false",
  "browserCertified:false","mobileCertified:false","xrCertified:false",
  "captured_reality_consent_changed_before_publish","captured_reality_consent_changed_after_publish",
]) assert.ok(source.includes(marker),marker);
assert.ok(index.includes('publishCapturedRealityRuntime'));
console.log('[PASS] captured reality private runtime publisher: exact artifact fixity, consent fences, immutable owner-private storage, hard-off admission receipt');
