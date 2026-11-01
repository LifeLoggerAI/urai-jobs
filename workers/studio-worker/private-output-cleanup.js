'use strict';
/** Delete only positively attributed uploaded generations, never arbitrary live paths. */
async function cleanupPinnedPrivateOutputs(bucket, writtenObjects, failureCode) {
  const results = await Promise.allSettled(writtenObjects.map(async (entry) => {
    if (!entry || typeof entry.destination !== 'string' || !entry.destination ||
        typeof entry.generation !== 'string' || !/^[1-9][0-9]{0,19}$/.test(entry.generation) ||
        !Number.isSafeInteger(Number(entry.generation))) {
      throw new Error('invalid_private_output_cleanup_generation');
    }
    await bucket.file(entry.destination, {
      generation: Number(entry.generation),
      preconditionOpts: { ifGenerationMatch: entry.generation },
    }).delete({ ignoreNotFound: true });
  }));
  if (results.some((result) => result.status === 'rejected')) {
    throw new Error(failureCode);
  }
}
module.exports = { cleanupPinnedPrivateOutputs };
