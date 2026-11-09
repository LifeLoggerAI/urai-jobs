/** Observe the actual terminal lifecycle: the master remains cancelled while
 * its queue row is cancelled transiently, then removed by the cleanup trigger.
 * A missing row is a completed cleanup, never evidence of cancellation alone. */
export async function assertCancelledJobCleanup(db, jobId, {
  timeoutMs = 15_000,
  now = Date.now,
  pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
} = {}) {
  const deadline = now() + timeoutMs;
  while (true) {
    const [job, queue] = await Promise.all([
      db.collection('jobs').doc(jobId).get(),
      db.collection('jobQueue').doc(jobId).get(),
    ]);
    // Delayed SDK reads or a late timer must not certify cleanup outside the
    // declared observation window, even if the queue has disappeared.
    if (now() > deadline) throw new Error('Terminal cleanup did not remove the cancelled-job queue entry before the deadline.');
    if (!job.exists || job.data()?.status !== 'CANCELLED') {
      throw new Error('Cancelled job master is missing or no longer CANCELLED.');
    }
    if (!queue.exists) return;
    if (queue.data()?.status !== 'CANCELLED') {
      throw new Error('Remaining cancelled-job queue entry is not CANCELLED.');
    }
    if (now() >= deadline) throw new Error('Terminal cleanup did not remove the cancelled-job queue entry before the deadline.');
    await pause(Math.min(250, Math.max(1, deadline - now())));
  }
}
