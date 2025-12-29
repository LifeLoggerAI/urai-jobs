import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { VertexAI } from "@google-cloud/vertexai";

admin.initializeApp();
const db = admin.firestore();

// --- 1. ENQUEUE API (Unchanged) --- //
type EnqueueBody = {
  jobId: string;
  idempotencyKey?: string;
  payload?: Record<string, any>;
  triggeredBy?: "api" | "human" | "scheduler" | "event";
};

export const api = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).send("POST only");
    }
    const body = req.body as EnqueueBody;
    if (!body?.jobId) {
      return res.status(400).json({ error: "Missing jobId" });
    }
    const jobRef = db.collection("jobs").doc(body.jobId);
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) {
      return res.status(404).json({ error: "Job not found" });
    }
    const runRef = db.collection("jobRuns").doc();
    const now = admin.firestore.Timestamp.now();
    await runRef.set({
      jobId: body.jobId,
      state: "queued",
      attempt: 1,
      idempotencyKey: body.idempotencyKey || runRef.id,
      triggeredBy: body.triggeredBy || "api",
      payload: body.payload || {},
      scheduledAt: now,
      createdAt: now,
    });
    return res.status(202).json({ ok: true, runId: runRef.id });
  } catch (e: any) {
    console.error("Error in enqueue API:", e);
    return res.status(500).json({ error: e?.message || "unknown error" });
  }
});

// --- 2. WORKER (with updated resume.analysis handler) --- //

const jobHandlers: { [key: string]: (runDoc: admin.firestore.DocumentSnapshot, payload: any) => Promise<any> } = {
  "system.noop": async (runDoc, payload) => {
    console.log(`Executing noop job for run ${runDoc.id}.`);
    return { details: "NOOP job completed successfully." };
  },
  "system.fail": async (runDoc, payload) => {
    console.log(`Executing system.fail job for run ${runDoc.id}.`);
    throw new Error("This job is designed to fail for testing purposes.");
  },
  "resume.analysis": async (runDoc, payload) => {
    const { applicationId, resumeText } = payload;
    if (!applicationId || !resumeText) {
        throw new Error("Payload for 'resume.analysis' must contain 'applicationId' and 'resumeText'.");
    }

    // Initialize Vertex AI
    const vertex_ai = new VertexAI({ project: process.env.GCLOUD_PROJECT!, location: 'us-central1' });
    const model = 'gemini-1.0-pro';

    // Create the prompt for the AI model
    const prompt = `Analyze the following resume and extract key information.
        Provide a 2-3 sentence professional summary and a list of the most
        relevant skills. Respond in valid JSON format with keys \"summary\" and \"skills\".

        Resume:
        ---
        ${resumeText}
        ---`;

    // Call the generative model
    const generativeModel = vertex_ai.getGenerativeModel({ model: model });
    const resp = await generativeModel.generateContent(prompt);
    
    const jsonString = resp.response.candidates[0].content.parts[0].text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

    const analysisResult = JSON.parse(jsonString);

    // Save the analysis back to the application document
    await db.collection("applications").doc(applicationId).update({
        analysis: analysisResult,
        status: 'analyzed'
    });

    console.log(`Resume analysis complete for application ${applicationId}.`);
    return analysisResult;
  },
};

export const runJob = functions.firestore.onDocumentCreated("jobRuns/{runId}", async (event) => {
  const runDoc = event.data;
  if (!runDoc) return;

  const runId = runDoc.id;
  const runData = runDoc.data();

  if (runData.state !== 'queued') return;

  await db.collection("jobRuns").doc(runId).update({
    state: "running",
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const jobSnap = await db.collection("jobs").doc(runData.jobId).get();
  if (!jobSnap.exists) {
    await db.collection("jobRuns").doc(runId).update({
        state: "deadlettered",
        finishedAt: admin.firestore.FieldValue.serverTimestamp(),
        error: { message: `Job definition ${runData.jobId} not found.` },
    });
    return;
  }
  const jobData = jobSnap.data()!;

  try {
    const jobType = jobData.jobType;
    const handler = jobHandlers[jobType];
    if (!handler) {
      throw new Error(`No handler found for jobType: ${jobType}`);
    }
    const result = await handler(runDoc, runData.payload);
    await db.collection("jobRuns").doc(runId).update({
      state: "succeeded",
      finishedAt: admin.firestore.FieldValue.serverTimestamp(),n      result: result,
    });
    console.log(`Job run ${runId} SUCCEEDED.`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Job run ${runId} FAILED on attempt ${runData.attempt}:`, errorMessage);

    const maxAttempts = jobData.retryPolicy?.maxAttempts || 1;
    const nextAttempt = runData.attempt + 1;

    if (runData.attempt < maxAttempts) {
        await db.collection("jobRuns").doc(runId).update({
            state: "failed",
            finishedAt: admin.firestore.FieldValue.serverTimestamp(),
            error: { message: errorMessage },
        });
        const newRunRef = db.collection("jobRuns").doc();
        await newRunRef.set({
            ...runData,
            state: "queued",
            attempt: nextAttempt,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            scheduledAt: admin.firestore.FieldValue.serverTimestamp(), 
            startedAt: null,
            finishedAt: null,
        });
        console.log(`Retrying job ${runData.jobId}. Queued new run ${newRunRef.id} for attempt ${nextAttempt}.`);
    } else {
        await db.collection("jobRuns").doc(runId).update({
            state: "deadlettered",
            finishedAt: admin.firestore.FieldValue.serverTimestamp(),
            error: { message: `Exceeded max attempts (${maxAttempts}).` },
        });
        console.error(`Job run ${runId} has failed on all ${maxAttempts} attempts. Moved to dead-letter queue.`);
    }
  }
});

// --- 3. EXPORT NEW SECURE APPLY FUNCTION --- //
export { secureApply } from './apply';
