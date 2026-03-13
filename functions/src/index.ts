import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as express from "express";
import * as cors from "cors";

admin.initializeApp();

const app = express();
app.use(cors({ origin: true }));

const db = admin.firestore();

// Authentication middleware
const authenticate = async (req, res, next) => {
  const authorization = req.get("Authorization");
  if (!authorization || !authorization.startsWith("Bearer ")) {
    functions.logger.warn("Unauthorized: No token provided", { ip: req.ip });
    return res.status(401).send("Unauthorized: No token provided");
  }

  const tokenId = authorization.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(tokenId);
    if (decodedToken.serviceAccount !== true) {
        functions.logger.warn("Forbidden: Not a service account", { uid: decodedToken.uid });
        return res.status(403).send("Forbidden: Not a service account");
    }
    res.locals.user = decodedToken;
    return next();
  } catch (error) {
    functions.logger.error("Error verifying auth token:", error, { tokenId: tokenId.substring(0, 5) });
    return res.status(401).send("Unauthorized: Invalid token");
  }
};

app.use(authenticate);

// API routes
app.post("/jobs/enqueue", async (req, res) => {
  const { type, payload, sourceService } = req.body;

  if (!type || !payload || !sourceService) {
    return res.status(400).send("Missing required fields: type, payload, sourceService");
  }

  let priority;
  switch (type) {
    case "analytics_aggregation":
      priority = 1;
      break;
    case "asset_generation":
      priority = 2;
      break;
    case "ai_analysis":
      priority = 3;
      break;
    case "data_enrichment":
      priority = 4;
      break;
    default:
      return res.status(400).send(`Invalid job type: ${type}`);
  }

  const job = {
    type,
    payload,
    status: "queued",
    priority,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    retryCount: 0,
    maxRetries: 3, // Default max retries
    sourceService,
  };

  try {
    const jobRef = await db.collection("jobs").add(job);
    functions.logger.info(`Job enqueued`, { jobId: jobRef.id, type, sourceService });
    return res.status(201).send({ id: jobRef.id });
  } catch (error) {
    functions.logger.error("Error enqueuing job:", error, { job });
    return res.status(500).send("Internal Server Error");
  }
});

app.get("/jobs/:jobId", async (req, res) => {
    const { jobId } = req.params;
    try {
        const jobDoc = await db.collection('jobs').doc(jobId).get();
        if (!jobDoc.exists) {
            return res.status(404).send('Job not found');
        }
        return res.status(200).send({ id: jobDoc.id, ...jobDoc.data() });
    } catch (error) {
        functions.logger.error(`Error fetching job ${jobId}:`, error);
        return res.status(500).send('Internal Server Error');
    }
});

app.get("/jobs/results/:jobId", async (req, res) => {
    const { jobId } = req.params;
    try {
        const resultDoc = await db.collection('jobResults').doc(jobId).get();
        if (!resultDoc.exists) {
            return res.status(404).send('Job result not found');
        }
        return res.status(200).send({ jobId: resultDoc.id, ...resultDoc.data() });
    } catch (error) {
        functions.logger.error(`Error fetching job result for ${jobId}:`, error);
        return res.status(500).send('Internal Server Error');
    }
});

app.get("/jobs/queues", async (req, res) => {
    try {
        const queuesSnapshot = await db.collection("jobQueues").get();
        const queues = queuesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const queuedJobs = await db.collection('jobs').where('status', '==', 'queued').get();
        const processingJobs = await db.collection('jobs').where('status', '==', 'processing').get();

        const healthMetrics = {
            queues,
            statusCounts: {
                queued: queuedJobs.size,
                processing: processingJobs.size,
            }
        };

        return res.status(200).send(healthMetrics);
    } catch (error) {
        functions.logger.error("Error fetching queue health:", error);
        return res.status(500).send("Internal Server Error");
    }
});

// Expose the Express API as a Cloud Function
export const api = functions.https.onRequest(app);

// Export job processing function
export { processJob } from "./processJob";

// Export job retry function
export { retryFailedJob } from "./retryFailedJob";

// Export job verification function
export { verifyJob } from "./verifyJob";

// Export scheduled retry function
export { scheduledRetry } from "./scheduledRetry";
