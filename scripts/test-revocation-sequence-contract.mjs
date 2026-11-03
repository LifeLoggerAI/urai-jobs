import test from 'node:test';
import assert from 'node:assert/strict';

// Adversarial specification for the Jobs source contract: a missing anchor
// must never be accepted because String#indexOf returns -1.
function followsTransaction(source) {
  const transaction = source.indexOf('const outcome = await db.runTransaction');
  const cleanup = source.indexOf('invalidateLifeMovieDerivativesForConsent(lifeMovieRevocationEvent)');
  return transaction !== -1 && cleanup > transaction;
}
const original = 'const outcome = await db.runTransaction(async () => {});\nconst derivativeInvalidation = await invalidateLifeMovieDerivativesForConsent(lifeMovieRevocationEvent);';
test('cleanup after real transaction anchor satisfies ordering',()=>assert.equal(followsTransaction(original),true));
test('missing transaction anchor cannot pass by indexOf -1',()=>assert.equal(followsTransaction('const derivativeInvalidation = await invalidateLifeMovieDerivativesForConsent(lifeMovieRevocationEvent);'),false));
test('cleanup before transaction is rejected',()=>assert.equal(followsTransaction(original.split('\n').reverse().join('\n')),false));
test('renamed obsolete ack transaction anchor cannot pass',()=>assert.equal(followsTransaction(original.replace('const outcome =','const ack =')),false));
