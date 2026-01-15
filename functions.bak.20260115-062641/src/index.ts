import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";
import { Job, JobStatus, JobEvent, Artifact } from "./types";

// --- Firebase Admin Initialization (Safe for Analysis) ---
// Initialize lazily to prevent crashes during pre-deploy analysis.
let _db: admin.firestore.Firestore;
const db = () => {
  if (!_db) {
    admin.initializeApp();
    _db = admin.firestore();
  }
  return _db;
};

let _storage: admin.storage.Storage;
const storage = () => {
    if (!_storage) {
        if (!admin.apps.length) admin.initializeApp();
        _storage = admin.storage();
    }
    return _storage;
};

// --- Helper Functions ---
const emitEvent = async (jobId: string, from: JobStatus | null, to: JobStatus, source: "urai-jobs" | "asset-factory", detail?: Record<string, any>): Promise<void> => {
  const event: JobEvent = { jobId, from, to, at: admin.firestore.Timestamp.now(), source, detail };
  await db().collection("jobEvents").add(event);
  functions.logger.info(`Event for ${jobId}: ${from || "null"} -> ${to}`, { jobId });
};

const setJobStatus = async (jobRef: admin.firestore.DocumentReference, status: JobStatus, extraData: Record<string, any> = {}): Promise<void> => {
  await jobRef.update({ status, updatedAt: admin.firestore.FieldValue.serverTimestamp(), ...extraData });
};

// =================================================================================================
// === API SURFACE 1: Job Intake (HTTP Callable)
// =================================================================================================
export const createJob = functions.https.onCall(async (data, context) => {
  // In a real system, we'd validate the auth context and input data schema.
  const { type, renderSpec, publishPolicy, ownerId } = data;
  if (!type || !renderSpec || !publishPolicy || !ownerId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required job parameters.");
  }

  const jobId = db().collection("jobs").doc().id;
  const newJob: Job = {
    jobId,
    ownerId: ownerId, // Should come from context.auth.uid in a real app
    type,
    status: "queued",
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
    renderSpec,
    publishPolicy,
    artifacts: [],
  };

  await db().collection("jobs").doc(jobId).set(newJob);
  await emitEvent(jobId, null, "queued", "urai-jobs", { ownerId });

  functions.logger.info(`Job ${jobId} created and queued.`, { jobId, type });
  return { jobId, status: "queued" };
});


// =================================================================================================
// === API SURFACE 2: Dispatcher (Firestore Trigger)
// =================================================================================================
// This function claims a job and calls asset-factory.
export const dispatchJob = functions.firestore.document("jobs/{jobId}")
  .onCreate(async (snap, context) => {
    const { jobId } = context.params;
    const job = snap.data() as Job;

    if (job.status !== "queued") {
      functions.logger.warn(`Job ${jobId} created with non-queued status: ${job.status}. Ignoring.`);
      return;
    }

    // 1. Claim the job atomically
    functions.logger.info(`Claiming job ${jobId}...`);
    await setJobStatus(snap.ref, "claimed");
    await emitEvent(jobId, "queued", "claimed", "urai-jobs");
    
    // 2. Dispatch to asset-factory (using our internal mock)
    try {
      const functionUrl = `http://127.0.0.1:5001/${process.env.GCLOUD_PROJECT}/us-central1/mockAssetFactory`;
      
      functions.logger.info(`Dispatching ${jobId} to mock asset-factory at ${functionUrl}`);
      
      // We don't await this call; it's fire-and-forget. The factory will call us back.
      axios.post(functionUrl, {
        jobId: job.jobId,
        renderSpec: job.renderSpec,
      }, {
        headers: { 'Content-Type': 'application/json' }
      }).catch(err => {
        // Log errors but don't fail the trigger, as the call might have gone through.
        // A sweeper function would be needed to handle jobs stuck in 'claimed'.
        functions.logger.error(`Error calling mock asset-factory for ${jobId}`, { jobId, error: err.message });
      });

    } catch (error: any) {
      functions.logger.error(`Failed to dispatch ${jobId}`, { jobId, error: error.message });
      await setJobStatus(snap.ref, "error", { error: { message: "Failed to dispatch to asset-factory", at: admin.firestore.Timestamp.now() } });
      await emitEvent(jobId, "claimed", "error", "urai-jobs", { error: error.message });
    }
  });


// =================================================================================================
// === MOCK SYSTEM: The Mock Asset-Factory (HTTP Request)
// =================================================================================================
// This function simulates the external asset-factory service.
// It waits, "creates" an artifact, and calls the callback handler.
export const mockAssetFactory = functions.https.onRequest(async (req, res) => {
    const { jobId, renderSpec } = req.body;
    
    // Immediately set job to 'rendering'
    const jobRef = db().collection("jobs").doc(jobId);
    await setJobStatus(jobRef, "rendering");
    await emitEvent(jobId, "claimed", "rendering", "urai-jobs");

    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 2000));

    // "Upload" a file to storage and create metadata
    const bucket = storage().bucket();
    const fileName = `artifacts/${jobId}/render_output.txt`;
    const file = bucket.file(fileName);
    const contents = `Rendered artifact for job ${jobId} with payload: ${JSON.stringify(renderSpec.payload)}`;
    await file.save(contents, { contentType: "text/plain" });

    const [metadata] = await file.getMetadata();

    const artifact: Artifact = {
      type: "render-output",
      format: "txt",
      gsUri: `gs://${metadata.bucket}/${metadata.name}`,
      contentType: metadata.contentType || "text/plain",
      size: Number(metadata.size),
      checksum: metadata.md5Hash || "",
      metadata: { renderedBy: "mock-asset-factory" }
    };
    
    // Call the finalizer/callback function
    const callbackUrl = `http://127.0.0.1:5001/${process.env.GCLOUD_PROJECT}/us-central1/finalizeJob`;
    axios.post(callbackUrl, {
      jobId,
      artifacts: [artifact],
    }).catch(err => functions.logger.error(`Mock Factory: Failed to call callback for ${jobId}`, { error: err.message }));
    
    res.status(202).send({ message: "Render accepted, callback will be invoked." });
});


// =================================================================================================
// === API SURFACE 3: Callback/Publisher Handler (HTTP Request)
// =================================================================================================
export const finalizeJob = functions.https.onRequest(async (req, res) => {
    const { jobId, artifacts } = req.body;
    if (!jobId || !artifacts) {
        return res.status(400).send("Missing jobId or artifacts.");
    }
    
    const jobRef = db().collection("jobs").doc(jobId);
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
        return res.status(404).send("Job not found.");
    }
    const job = jobSnap.data() as Job;

    // Idempotency check
    if (job.status !== "rendering") {
        functions.logger.warn(`Received callback for job ${jobId} already in status ${job.status}. Ignoring.`);
        return res.status(200).send("Duplicate callback ignored.");
    }

    // 1. Mark as 'uploaded'
    await setJobStatus(jobRef, "uploaded", { artifacts });
    await emitEvent(jobId, "rendering", "uploaded", "asset-factory", { artifactCount: artifacts.length });
    
    // 2. Apply Publish Policy
    const finalArtifacts: Artifact[] = [...artifacts];
    const { visibility, signedUrlTtlSec } = job.publishPolicy;
    
    for (const artifact of finalArtifacts) {
        const file = storage().bucket().file(artifact.gsUri.replace(/gs:\/\/[^/]+\//, ''));
        if (visibility === 'public') {
            await file.makePublic();
            artifact.publicUrl = file.publicUrl();
        } else if (visibility === 'signed') {
            const [signedUrl] = await file.getSignedUrl({
                action: 'read',
                expires: Date.now() + (signedUrlTtlSec || 3600) * 1000,
            });
            artifact.signedUrl = signedUrl;
        }
    }

    // 3. Mark as 'published'
    await setJobStatus(jobRef, "published", { artifacts: finalArtifacts });
    await emitEvent(jobId, "uploaded", "published", "urai-jobs", { visibility });

    functions.logger.info(`Job ${jobId} successfully published.`, { jobId });
    return res.status(200).send("Job finalized and published.");
});
