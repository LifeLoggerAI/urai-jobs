import express, { Request, Response } from 'express';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(express.json());

app.post('/', async (req: Request, res: Response) => {
    const { jobId, leaseToken } = req.body;

    if (!jobId || !leaseToken) {
        console.error("Invalid request body:", req.body);
        return res.status(400).send("jobId and leaseToken are required.");
    }

    const jobRef = db.collection('jobs').doc(jobId);
    const queueRef = db.collection('jobQueue').doc(jobId);

    try {
        const jobDoc = await jobRef.get();
        const queueDoc = await queueRef.get();

        if (!jobDoc.exists || !queueDoc.exists) {
            throw new Error(`Job or JobQueue doc not found for jobId: ${jobId}`);
        }

        const queueData = queueDoc.data();

        if (!queueData || queueData.leaseToken !== leaseToken) {
            throw new Error(`Invalid lease token for job ${jobId}.`);
        }

        // Mark as running
        const now = admin.firestore.Timestamp.now();
        await jobRef.update({ 
            status: 'RUNNING', 
            'execution.startedAt': now,
            'execution.heartbeatAt': now,
            'timestamps.updatedAt': now,
        });

        // Simulate long-running work
        console.log(`Starting work for job ${jobId}...`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
        console.log(`Finished work for job ${jobId}.`);

        const durationMs = Date.now() - now.toMillis();

        // Commit terminal state
        const resultRef = db.collection('jobResults').doc(jobId);
        const batch = db.batch();

        batch.update(jobRef, {
            status: 'SUCCESS',
            'progress.percent': 100,
            'execution.completedAt': admin.firestore.Timestamp.now(),
        });

        batch.update(queueRef, {
            status: 'DONE',
        });

        batch.set(resultRef, {
            jobId,
            status: 'SUCCESS',
            producedAt: admin.firestore.Timestamp.now(),
            durationMs,
            summary: 'Job completed successfully in worker.',
        });

        await batch.commit();

        res.status(200).send('Job execution completed');

    } catch (error) {
        console.error(`Error executing job ${jobId}:`, error);
        // Basic error handling: mark job as failed
        await jobRef.update({ status: 'FAILED', 'error.message': (error as Error).message });
        await queueRef.update({ status: 'DEAD' });
        res.status(500).send('Job execution failed');
    }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Worker listening on port ${port}`);
});
