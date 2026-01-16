
import { functuons, db } from '../firebase';

describe('Job E2E Smoke Test', () => {
    it('should complete a full job lifecycle', async () => {
        const enqueue = functions.httpsCallable('enqueue');
        const requeue = functions.httpsCallable('requeue');
        const cancel = functions.httpsCallable('cancel');

        // 1. Enqueue a job
        const enqueueResult = await enqueue({ type: 'echo', payload: { message: 'hello' } });
        const jobId = enqueueResult.data.jobId;
        expect(jobId).toBeDefined();

        // 2. Dispatcher should run the job
        // (Assuming dispatcher runs every minute, we might need to wait)
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for dispatcher

        // 3. Check job status
        const jobDoc = await db.collection('jobs').doc(jobId).get();
        const job = jobDoc.data();
        expect(job.status).toBe('SUCCEEDED');

        // 4. Requeue and run again
        await requeue({ jobId });
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for dispatcher
        const requeuedJobDoc = await db.collection('jobs').doc(jobId).get();
        const requeuedJob = requeuedJobDoc.data();
        expect(requeuedJob.status).toBe('SUCCEEDED');
        expect(requeuedJob.attempts).toBe(2);

        // 5. Cancel a job
        const cancelResult = await enqueue({ type: 'echo', payload: { message: 'to be canceled' } });
        const jobToCancelId = cancelResult.data.jobId;
        await cancel({ jobId: jobToCancelId });
        const canceledJobDoc = await db.collection('jobs').doc(jobToCancelId).get();
        const canceledJob = canceledJobDoc.data();
        expect(canceledJob.status).toBe('CANCELED');
    }, 30000); // 30s timeout for this test
});
