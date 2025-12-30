
import * as express from "express";
import * as cors from "cors";
import * as admin from "firebase-admin";
import { z } from "zod";
import { handlers } from "./jobs/handlers";
import { Config, Job } from "./types";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const db = admin.firestore();

// #############################################################################
// Middleware
// #############################################################################

const isAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const traceId = req.headers['x-trace-id'] || uuidv4();
  const bearer = req.headers.authorization;
  if (!bearer || !bearer.startsWith("Bearer ")) {
    return res.status(401).send({ error: "Unauthorized", traceId });
  }
  const idToken = bearer.split("Bearer ")[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    if (decodedToken.admin !== true) {
      return res.status(403).send({ error: "Forbidden", traceId });
    }
    req.user = decodedToken;
    next();
  } catch (error) {
    logger.warn("Token verification failed", { error, traceId });
    return res.status(401).send({ error: "Unauthorized", traceId });
  }
};

const isServiceOrAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const traceId = req.headers['x-trace-id'] || uuidv4();
  // Check for service token first
  const serviceToken = req.headers["x-urai-service-token"];
  if (serviceToken) {
    // In a real scenario, you'd look up the token and its permissions
    // For this example, we'll use a placeholder secret
    const { URAI_JOBS_SERVICE_TOKEN } = process.env;
    if (URAI_JOBS_SERVICE_TOKEN && serviceToken === URAI_JOBS_SERVICE_TOKEN) {
      req.user = { uid: `service:${req.headers['x-urai-service-name'] || 'unknown'}` };
      return next();
    }
  }

  // Fallback to checking for admin user
  const bearer = req.headers.authorization;
  if (!bearer || !bearer.startsWith("Bearer ")) {
    return res.status(401).send({ error: "Unauthorized", traceId });
  }
  const idToken = bearer.split("Bearer ")[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    if (decodedToken.admin === true) {
      req.user = decodedToken;
      return next();
    }
    return res.status(403).send({ error: "Forbidden", traceId });
  } catch (error) {
    logger.warn("Token verification failed", { error, traceId });
    return res.status(401).send({ error: "Unauthorized", traceId });
  }
};

// #############################################################################
// Public API
// #############################################################################

app.get("/health", async (req, res) => {
  const traceId = req.headers['x-trace-id'] || uuidv4();
  try {
    const [queued, running, dead] = await Promise.all([
      db.collection("jobs").where("status", "==", "queued").count().get(),
      db.collection("jobs").where("status", "==", "running").count().get(),
      db.collection("jobs").where("status", "==", "dead").count().get(),
    ]);

    res.status(200).send({
      ok: true,
      service: "urai-jobs",
      env: process.env.NODE_ENV || "dev",
      version: process.env.GIT_SHA || "unknown",
      region: process.env.FUNCTION_REGION || "unknown",
      time: new Date().toISOString(),
      stats: {
        queued: queued.data().count,
        running: running.data().count,
        dead: dead.data().count,
      },
      traceId
    });
  } catch (error) {
    logger.error("Health check failed", { error, traceId });
    res.status(500).send({ ok: false, error: "Failed to retrieve job stats.", traceId });
  }
});


// #############################################################################
// Admin Bootstrap
// #############################################################################

const bootstrapSchema = z.object({
  uid: z.string().min(1),
  token: z.string().min(1),
});

app.post("/adminBootstrap", async (req, res) => {
  const traceId = req.headers['x-trace-id'] || uuidv4();
  const validation = bootstrapSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).send({ error: "Invalid request body", details: validation.error.issues, traceId });
  }

  const { uid, token } = validation.data;

  // IMPORTANT: This token must be set as a secret environment variable
  const { ADMIN_BOOTSTRAP_TOKEN } = process.env;
  if (!ADMIN_BOOTSTRAP_TOKEN || token !== ADMIN_BOOTSTRAP_TOKEN) {
    return res.status(403).send({ error: "Forbidden: Invalid bootstrap token.", traceId });
  }

  const configRef = db.collection("config").doc("jobs");
  try {
    await db.runTransaction(async (tx) => {
      const configSnap = await tx.get(configRef);
      const config = configSnap.data() as Config || {};

      if (config.sealedAdminBootstrap) {
        throw new Error("Admin bootstrap is already sealed.");
      }

      await getAuth().setCustomUserClaims(uid, { admin: true });

      tx.set(configRef, { sealedAdminBootstrap: true }, { merge: true });

      const auditLog = {
        at: FieldValue.serverTimestamp(),
        action: "admin.bootstrap",
        target: `users/${uid}`,
        actorUid: "system", // Or extract from a service account if available
        meta: { sealed: true },
      };
      tx.set(db.collection("auditLogs").doc(), auditLog);
    });

    logger.info(`Admin claim set for UID: ${uid}. Bootstrap sealed.`, { traceId, uid });
    res.status(200).send({ success: true, message: `Admin claim set for UID: ${uid}. Bootstrap is now sealed.` });

  } catch (error) {
    logger.error("Admin bootstrap failed", { error, uid, traceId });
    res.status(500).send({ error: (error as Error).message, traceId });
  }
});


// #############################################################################
// v1 API Router
// #############################################################################

const v1 = express.Router();

// Middleware for all v1 routes
v1.use((req, res, next) => {
  req.traceId = req.headers['x-trace-id'] as string || uuidv4();
  next();
});


// -----------------------------------------------------------------------------
// Job Creation
// -----------------------------------------------------------------------------
const createJobSchema = z.object({
  type: z.string().min(1).max(50),
  payload: z.object({}).passthrough().optional(),
  priority: z.number().int().min(0).optional(),
  maxAttempts: z.number().int().min(1).optional(),
  timeoutSeconds: z.number().int().min(1).optional(),
  idempotencyKey: z.string().min(1).max(128).optional(),
});

v1.post("/jobs", isServiceOrAdmin, async (req, res) => {
  const validation = createJobSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).send({ error: "Invalid job data", details: validation.error.issues, traceId: req.traceId });
  }

  const { type, payload, priority, maxAttempts, timeoutSeconds, idempotencyKey } = validation.data;
  const traceId = req.traceId as string;

  if (!handlers[type]) {
    return res.status(400).send({ error: `Unknown job type: ${type}`, traceId });
  }

  try {
    // Idempotency check
    if (idempotencyKey) {
      const idemRef = db.collection("idempotency").doc(idempotencyKey);
      const idemSnap = await idemRef.get();
      if (idemSnap.exists) {
        const { jobId } = idemSnap.data() as { jobId: string };
        const jobSnap = await db.collection("jobs").doc(jobId).get();
        if (jobSnap.exists) {
          logger.info("Idempotent job creation request ignored.", { jobId, idempotencyKey, traceId });
          return res.status(200).send({ id: jobSnap.id, ...jobSnap.data() });
        }
      }
    }

    const configSnap = await db.collection("config").doc("jobs").get();
    const config = (configSnap.data() as Config) || {};

    const newJob: Job = {
      type,
      payload: payload || {},
      status: "queued",
      priority: priority || 0,
      createdAt: FieldValue.serverTimestamp() as Timestamp,
      updatedAt: FieldValue.serverTimestamp() as Timestamp,
      createdBy: {
        uid: req.user?.uid,
        service: req.headers['x-urai-service-name'] as string | undefined,
       },
      attempts: 0,
      maxAttempts: maxAttempts || config.defaultMaxAttempts || 5,
      nextRunAt: FieldValue.serverTimestamp() as Timestamp,
      timeoutSeconds,
      idempotencyKey,
      traceId,
    };

    const jobRef = await db.collection("jobs").add(newJob);

    if (idempotencyKey) {
      await db.collection("idempotency").doc(idempotencyKey).set({
        jobId: jobRef.id,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    logger.info("Job created successfully", { jobId: jobRef.id, type, traceId });
    res.status(201).send({ id: jobRef.id, ...newJob });

  } catch (error) {
    logger.error("Failed to create job", { error, type, traceId });
    res.status(500).send({ error: "Internal server error", traceId });
  }
});


// -----------------------------------------------------------------------------
// Job Management
// -----------------------------------------------------------------------------

v1.get("/jobs/:id", isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const jobSnap = await db.collection("jobs").doc(id).get();
    if (!jobSnap.exists) {
      return res.status(404).send({ error: "Job not found", traceId: req.traceId });
    }
    res.status(200).send({ id: jobSnap.id, ...jobSnap.data() });
  } catch (error) {
    logger.error("Failed to get job", { error, jobId: id, traceId: req.traceId });
    res.status(500).send({ error: "Internal server error", traceId: req.traceId });
  }
});

v1.post("/jobs/:id/cancel", isAdmin, async (req, res) => {
  const { id } = req.params;
  const traceId = req.traceId as string;
  const jobRef = db.collection("jobs").doc(id);

  try {
    await db.runTransaction(async tx => {
      const jobSnap = await tx.get(jobRef);
      if (!jobSnap.exists) {
        throw new Error("Job not found");
      }
      const job = jobSnap.data() as Job;
      if (job.status === 'succeeded' || job.status === 'canceled' || job.status === 'dead') {
         throw new Error(`Job in status '${job.status}' cannot be canceled.`);
      }

      tx.update(jobRef, {
        status: "canceled",
        updatedAt: FieldValue.serverTimestamp(),
      });

      const auditLog = {
        at: FieldValue.serverTimestamp(),
        action: "job.cancel",
        target: `jobs/${id}`,
        actorUid: req.user?.uid,
        meta: { fromStatus: job.status, toStatus: "canceled" },
      };
      tx.set(db.collection("auditLogs").doc(), auditLog);
    });

    logger.info("Job canceled", { jobId: id, traceId });
    res.status(200).send({ success: true, message: "Job canceled successfully." });

  } catch (error) {
    const message = (error as Error).message;
    logger.error("Failed to cancel job", { error, jobId: id, traceId });
    const status = message === "Job not found" ? 404 : 400;
    res.status(status).send({ error: message, traceId });
  }
});

v1.post("/jobs/:id/retry", isAdmin, async (req, res) => {
  const { id } = req.params;
  const traceId = req.traceId as string;
  const jobRef = db.collection("jobs").doc(id);

  try {
    await db.runTransaction(async tx => {
      const jobSnap = await tx.get(jobRef);
      if (!jobSnap.exists) {
        throw new Error("Job not found");
      }
      const job = jobSnap.data() as Job;
      if (job.status !== "dead" && job.status !== "failed") {
        throw new Error("Job is not in a retryable state.");
      }

      tx.update(jobRef, {
        status: "queued",
        attempts: 0, // Reset attempts
        nextRunAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        error: FieldValue.delete(), // Clear last error
      });

       const auditLog = {
        at: FieldValue.serverTimestamp(),
        action: "job.retry",
        target: `jobs/${id}`,
        actorUid: req.user?.uid,
        meta: { fromStatus: job.status, toStatus: "queued" },
      };
      tx.set(db.collection("auditLogs").doc(), auditLog);
    });

    logger.info("Job retried", { jobId: id, traceId });
    res.status(200).send({ success: true, message: "Job queued for retry." });

  } catch (error) {
    const message = (error as Error).message;
    logger.error("Failed to retry job", { error, jobId: id, traceId });
    const status = message === "Job not found" ? 404 : 400;
    res.status(status).send({ error: message, traceId });
  }
});


// -----------------------------------------------------------------------------
// Admin Views
// -----------------------------------------------------------------------------
const listJobsQuerySchema = z.object({
  status: z.enum(["queued", "running", "succeeded", "failed", "canceled", "dead"]).optional(),
  type: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

v1.get("/admin/jobs", isAdmin, async (req, res) => {
  const validation = listJobsQuerySchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).send({ error: "Invalid query parameters", details: validation.error.issues, traceId: req.traceId });
  }
  const { status, type, limit = 20, cursor } = validation.data;
  const traceId = req.traceId as string;

  try {
    let query: admin.firestore.Query = db.collection("jobs").orderBy("createdAt", "desc");

    if (status) query = query.where("status", "==", status);
    if (type) query = query.where("type", "==", type);
    if (limit) query = query.limit(limit);
    if (cursor) {
      const cursorSnap = await db.collection("jobs").doc(cursor).get();
      if(cursorSnap.exists) {
        query = query.startAfter(cursorSnap);
      }
    }

    const jobsSnap = await query.get();
    const jobs = jobsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const nextCursor = jobs.length === limit ? jobs[jobs.length - 1].id : null;

    res.status(200).send({ jobs, nextCursor });
  } catch (error) {
    logger.error("Failed to list jobs", { error, query: req.query, traceId });
    res.status(500).send({ error: "Internal server error", traceId });
  }
});


v1.get('/admin/stats', isAdmin, async (req, res) => {
    const traceId = req.traceId as string;
    try {
        const [queued, running, dead, succeeded, failed, canceled] = await Promise.all([
            db.collection("jobs").where("status", "==", "queued").count().get(),
            db.collection("jobs").where("status", "==", "running").count().get(),
            db.collection("jobs").where("status", "==", "dead").count().get(),
            db.collection("jobs").where("status", "==", "succeeded").count().get(),
            db.collection("jobs").where("status", "==", "failed").count().get(),
            db.collection("jobs").where("status", "==", "canceled").count().get(),
        ]);

        res.status(200).json({
            ok: true,
            stats: {
                queued: queued.data().count,
                running: running.data().count,
                dead: dead.data().count,
                succeeded: succeeded.data().count,
                failed: failed.data().count,
                canceled: canceled.data().count,
            },
            traceId,
        });

    } catch (error) {
        logger.error('Failed to get admin stats', { error, traceId });
        res.status(500).json({ ok: false, error: 'Internal Server Error', traceId });
    }
});


app.use("/v1", v1);

export const api = app;

// Add a simple declaration for the user object on the request
declare global {
  namespace Express {
    interface Request {
      user?: admin.auth.DecodedIdToken | { uid: string };
      traceId?: string;
    }
  }
}
