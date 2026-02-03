
import * as functions from 'firebase-functions';
import * as express from 'express';
import { nanoid } from 'nanoid';
import { Timestamp } from 'firebase-admin/firestore';
import { Job, JobSchema, JobStatus } from './types/jobs';
import { 
    getJob, 
    createJob, 
    updateJob, 
    lockJob, 
    heartbeatJob, 
    releaseJob, 
    pollJobs 
} from './firestore';
import { writeAuditEvent } from './audit';

const app = express();

const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const apiKey = req.get('x-urai-internal-key');
    if (apiKey && apiKey === process.env.URAI_INTERNAL_KEY) {
        next();
    } else {
        res.status(401).send('Unauthorized');
    }
};

app.use(authMiddleware);

app.post('/jobs/enqueue', async (req, res) => {
    try {
        const jobId = nanoid();
        const job: Job = {
            jobId,
            ...req.body,
            status: 'QUEUED',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        };

        const validatedJob = JobSchema.parse(job);
        await createJob(validatedJob);

        await writeAuditEvent({
            eventId: nanoid(),
            jobId,
            at: Timestamp.now(),
            type: 'ENQUEUED',
            actor: { kind: 'api', id: 'enqueue' },
        });

        res.status(200).json({ ok: true, jobId });
    } catch (error) {
        res.status(400).json({ ok: false, error });
    }
});

app.get('/jobs/poll', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;
        const kinds = req.query.kinds ? (req.query.kinds as string).split(',') : [];
        const jobs = await pollJobs(limit, kinds);
        res.status(200).json({ ok: true, jobs });
    } catch (error) {
        res.status(400).json({ ok: false, error });
    }
});

app.get('/jobs/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await getJob(jobId);
        if (job) {
            res.status(200).json({ ok: true, job });
        } else {
            res.status(404).json({ ok: false, error: 'Job not found' });
        }
    } catch (error) {
        res.status(400).json({ ok: false, error });
    }
});

app.post('/jobs/:jobId/cancel', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await getJob(jobId);

        if (!job) {
            return res.status(404).json({ ok: false, error: 'Job not found' });
        }

        await updateJob(jobId, { status: 'CANCELED' });

        await writeAuditEvent({
            eventId: nanoid(),
            jobId,
            at: Timestamp.now(),
            type: 'CANCELED',
            from: job.status,
            to: 'CANCELED',
            actor: { kind: 'api', id: 'cancel' },
        });

        res.status(200).json({ ok: true });
    } catch (error) {
        res.status(400).json({ ok: false, error });
    }
});

app.post('/jobs/:jobId/retry', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await getJob(jobId);

        if (!job) {
            return res.status(404).json({ ok: false, error: 'Job not found' });
        }

        if (job.status === 'FAILED' && job.attempt < job.maxAttempts) {
            await updateJob(jobId, { status: 'QUEUED', attempt: job.attempt + 1 });

            await writeAuditEvent({
                eventId: nanoid(),
                jobId,
                at: Timestamp.now(),
                type: 'RETRIED',
                from: job.status,
                to: 'QUEUED',
                actor: { kind: 'api', id: 'retry' },
            });

            const newJob = await getJob(jobId);
            res.status(200).json({ ok: true, job: newJob });
        } else {
            res.status(400).json({ ok: false, error: 'Job not eligible for retry' });
        }
    } catch (error) {
        res.status(400).json({ ok: false, error });
    }
});


app.post('/jobs/:jobId/lock', async (req, res) => {
    try {
        const { jobId } = req.params;
        const { workerId, leaseMs } = req.body;
        const job = await lockJob(jobId, workerId, leaseMs);

        if (job) {
            await writeAuditEvent({
                eventId: nanoid(),
                jobId,
                at: Timestamp.now(),
                type: 'LOCKED',
                actor: { kind: 'worker', id: workerId },
            });

            res.status(200).json({ ok: true, job });
        } else {
            res.status(409).json({ ok: false, error: 'Could not lock job' });
        }
    } catch (error) {
        res.status(400).json({ ok: false, error });
    }
});

app.post('/jobs/:jobId/heartbeat', async (req, res) => {
    try {
        const { jobId } = req.params;
        const { workerId, leaseMs } = req.body;
        const lockedUntil = await heartbeatJob(jobId, workerId, leaseMs);

        if (lockedUntil) {
            await writeAuditEvent({
                eventId: nanoid(),
                jobId,
                at: Timestamp.now(),
                type: 'HEARTBEAT',
                actor: { kind: 'worker', id: workerId },
            });

            res.status(200).json({ ok: true, lockedUntil });
        } else {
            res.status(409).json({ ok: false, error: 'Could not heartbeat job' });
        }
    } catch (error) {
        res.status(400).json({ ok: false, error });
    }
});

app.post('/jobs/:jobId/release', async (req, res) => {
    try {
        const { jobId } = req.params;
        const { workerId } = req.body;
        await releaseJob(jobId, workerId);

        await writeAuditEvent({
            eventId: nanoid(),
            jobId,
            at: Timestamp.now(),
            type: 'RELEASED',
            actor: { kind: 'worker', id: workerId },
        });

        res.status(200).json({ ok: true });
    } catch (error) {
        res.status(400).json({ ok: false, error });
    }
});



export const api = functions.https.onRequest(app);