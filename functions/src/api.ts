
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import { z } from 'zod';
import { JobSchema } from './models';

const app = express();
const db = admin.firestore();

// Middleware for authentication
const isAuthenticated = async (req: functions.Request, res: express.Response, next: express.NextFunction) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        res.status(401).send({ code: 'UNAUTHENTICATED', message: 'Unauthorized' });
        return;
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        (req as any).user = decodedToken;
        next();
    } catch (error) {
        res.status(401).send({ code: 'UNAUTHENTICATED', message: 'Unauthorized' });
    }
};

// Middleware for admin authorization
const isAdmin = async (req: functions.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    if (user.admin !== true) {
        res.status(403).send({ code: 'PERMISSION_DENIED', message: 'Forbidden' });
        return;
    }
    next();
};

app.post("/jobs", isAuthenticated, async (req, res) => {
    try {
        const { idempotencyKey, ...jobData } = JobSchema.omit({ ownerUid: true, status: true, attempts: true, createdAt: true, updatedAt: true, leaseExpiresAt: true, lastError: true, output: true }).parse(req.body);
        const ownerUid = (req as any).user.uid;

        const jobWithDefaults = {
            ...jobData,
            ownerUid,
            status: 'QUEUED' as const,
            attempts: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            leaseExpiresAt: null,
            lastError: null,
            output: null,
            idempotencyKey,
        };

        const existingJob = await db.collection('jobs').where('idempotencyKey', '==', idempotencyKey).where('ownerUid', '==', ownerUid).get();

        if (!existingJob.empty) {
            const job = existingJob.docs[0];
            res.status(200).send({ id: job.id, ...job.data() });
            return;
        }

        const job = await db.collection("jobs").add(jobWithDefaults);
        res.status(201).send({ id: job.id, ...jobWithDefaults });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).send({ code: 'INVALID_ARGUMENT', message: 'Invalid job data', details: error.errors });
        } else {
            res.status(500).send({ code: 'INTERNAL', message: 'Internal server error' });
        }
    }
});

app.get("/jobs/:jobId", isAuthenticated, async (req, res) => {
    try {
        const { jobId } = req.params;
        const ownerUid = (req as any).user.uid;

        const jobDoc = await db.collection("jobs").doc(jobId).get();
        if (!jobDoc.exists) {
            res.status(404).send({ code: 'NOT_FOUND', message: 'Job not found' });
            return;
        }

        const job = jobDoc.data();

        if (job?.ownerUid !== ownerUid && !(req as any).user.admin) {
            res.status(403).send({ code: 'PERMISSION_DENIED', message: 'Forbidden' });
            return;
        }

        res.status(200).send({ id: jobDoc.id, ...job });
    } catch (error) {
        res.status(500).send({ code: 'INTERNAL', message: 'Internal server error' });
    }
});


app.get("/jobs", isAuthenticated, async (req, res) => {
    try {
        const ownerUid = (req as any).user.uid;
        const isAdminUser = (req as any).user.admin === true;

        let query: admin.firestore.Query = db.collection("jobs");

        if (!isAdminUser) {
            query = query.where('ownerUid', '==', ownerUid);
        }

        const { status, type, page, pageSize } = req.query;

        if (status) {
            query = query.where('status', '==', status);
        }

        if (type) {
            query = query.where('type', '==', type);
        }

        const pageNum = parseInt(page as string, 10) || 1;
        const size = parseInt(pageSize as string, 10) || 10;

        const snapshot = await query.orderBy('createdAt', 'desc').limit(size).offset((pageNum - 1) * size).get();
        const jobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        res.status(200).send(jobs);
    } catch (error) {
        res.status(500).send({ code: 'INTERNAL', message: 'Internal server error' });
    }
});

app.post("/jobs/:jobId/cancel", isAuthenticated, async (req, res) => {
    try {
        const { jobId } = req.params;
        const ownerUid = (req as any).user.uid;

        const jobRef = db.collection("jobs").doc(jobId);
        const jobDoc = await jobRef.get();

        if (!jobDoc.exists) {
            res.status(404).send({ code: 'NOT_FOUND', message: 'Job not found' });
            return;
        }

        const job = jobDoc.data();

        if (job?.ownerUid !== ownerUid && !(req as any).user.admin) {
            res.status(403).send({ code: 'PERMISSION_DENIED', message: 'Forbidden' });
            return;
        }

        if (job?.status !== 'QUEUED' && job?.status !== 'RUNNING') {
            res.status(400).send({ code: 'FAILED_PRECONDITION', message: `Job in status ${job?.status} cannot be canceled` });
            return;
        }

        await jobRef.update({ status: 'CANCELED', updatedAt: admin.firestore.FieldValue.serverTimestamp() });

        res.status(200).send({ id: jobId, status: 'CANCELED' });
    } catch (error) {
        res.status(500).send({ code: 'INTERNAL', message: 'Internal server error' });
    }
});


app.post("/jobs/:jobId/retry", isAuthenticated, async (req, res) => {
    try {
        const { jobId } = req.params;
        const ownerUid = (req as any).user.uid;

        const jobRef = db.collection("jobs").doc(jobId);
        const jobDoc = await jobRef.get();

        if (!jobDoc.exists) {
            res.status(404).send({ code: 'NOT_FOUND', message: 'Job not found' });
            return;
        }

        const job = jobDoc.data();

        if (job?.ownerUid !== ownerUid && !(req as any).user.admin) {
            res.status(403).send({ code: 'PERMISSION_DENIED', message: 'Forbidden' });
            return;
        }

        if (job?.status !== 'FAILED') {
            res.status(400).send({ code: 'FAILED_PRECONDITION', message: `Job in status ${job?.status} cannot be retried` });
            return;
        }

        if (job.attempts >= job.maxAttempts) {
            res.status(400).send({ code: 'FAILED_PRECONDITION', message: `Job has reached max attempts (${job.maxAttempts})` });
            return;
        }

        await jobRef.update({ status: 'QUEUED', updatedAt: admin.firestore.FieldValue.serverTimestamp() });

        res.status(200).send({ id: jobId, status: 'QUEUED' });
    } catch (error) {
        res.status(500).send({ code: 'INTERNAL', message: 'Internal server error' });
    }
});


// Worker endpoints
app.post("/jobs/claimNext", isAuthenticated, isAdmin, async (req, res) => {
    // This endpoint should be called by workers only.
    // It finds a queued job, marks it as running, and returns it.

    try {
        const now = admin.firestore.Timestamp.now();
        const leaseTime = new admin.firestore.Timestamp(now.seconds + 3600, now.nanoseconds); // 1 hour lease

        const query = db.collection('jobs')
            .where('status', '==', 'QUEUED')
            .orderBy('priority', 'desc')
            .orderBy('createdAt', 'asc')
            .limit(1);

        const claimedJob = await db.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(query);
            if (snapshot.empty) {
                return null;
            }

            const jobDoc = snapshot.docs[0];
            const job = jobDoc.data();

            if (job.leaseExpiresAt && job.leaseExpiresAt > now) {
                return null; // Job is already leased
            }

            transaction.update(jobDoc.ref, { 
                status: 'RUNNING', 
                leaseExpiresAt: leaseTime, 
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                attempts: admin.firestore.FieldValue.increment(1)
            });

            return { id: jobDoc.id, ...job };
        });

        if (!claimedJob) {
            res.status(404).send({ code: 'NOT_FOUND', message: 'No available jobs' });
            return;
        }

        res.status(200).send(claimedJob);

    } catch (error) {
        res.status(500).send({ code: 'INTERNAL', message: 'Internal server error' });
    }
});

app.post("/jobs/:jobId/heartbeat", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { jobId } = req.params;

        const jobRef = db.collection("jobs").doc(jobId);
        const jobDoc = await jobRef.get();

        if (!jobDoc.exists) {
            res.status(404).send({ code: 'NOT_FOUND', message: 'Job not found' });
            return;
        }

        const job = jobDoc.data();

        if (job?.status !== 'RUNNING') {
            res.status(400).send({ code: 'FAILED_PRECONDITION', message: `Job in status ${job?.status} cannot be heartbeat` });
            return;
        }

        const now = admin.firestore.Timestamp.now();
        const leaseTime = new admin.firestore.Timestamp(now.seconds + 3600, now.nanoseconds); // 1 hour lease

        await jobRef.update({ leaseExpiresAt: leaseTime, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

        res.status(200).send({ id: jobId, leaseExpiresAt: leaseTime });

    } catch (error) {
        res.status(500).send({ code: 'INTERNAL', message: 'Internal server error' });
    }
});

const CompleteJobSchema = z.object({
    status: z.enum(['SUCCEEDED', 'FAILED']),
    output: z.any().optional(),
    lastError: z.any().optional(),
});

app.post("/jobs/:jobId/complete", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { jobId } = req.params;
        const { status, output, lastError } = CompleteJobSchema.parse(req.body);

        const jobRef = db.collection("jobs").doc(jobId);
        const jobDoc = await jobRef.get();

        if (!jobDoc.exists) {
            res.status(404).send({ code: 'NOT_FOUND', message: 'Job not found' });
            return;
        }

        const job = jobDoc.data();

        if (job?.status !== 'RUNNING') {
            res.status(400).send({ code: 'FAILED_PRECONDITION', message: `Job in status ${job?.status} cannot be completed` });
            return;
        }

        await jobRef.update({ 
            status, 
            output: output || null, 
            lastError: lastError || null,
            leaseExpiresAt: null, 
            updatedAt: admin.firestore.FieldValue.serverTimestamp() 
        });

        res.status(200).send({ id: jobId, status });

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).send({ code: 'INVALID_ARGUMENT', message: 'Invalid completion data', details: error.errors });
        } else {
            res.status(500).send({ code: 'INTERNAL', message: 'Internal server error' });
        }
    }
});

export const api = functions.https.onRequest(app);
