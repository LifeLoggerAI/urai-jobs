import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { backoffMs } from "./utils";
import type { Job } from "./types";
import { sendEmail } from "./email";
import { generateExport } from "./exporter";
import { runRollup } from "./analytics";
import { dispatchWebhooks } from "./webhook";

const db = admin.firestore();

type EmailPayload = { to: string; subject: string; text: string };

function isEmailPayload(x: any): x is EmailPayload {
  return (
    x &&
    typeof x.to === "string" &&
    typeof x.subject === "string" &&
    typeof x.text === "string"
  );
}

export const jobWorker = functions.firestore
  .document("jobs/{jobId}")
  .onCreate(async (snap) => {
    await handleJob(snap.ref, snap.data() as Job);
  });

// Also re-process when a queued job is "touched"
export const jobTouch = functions.firestore
  .document("jobs/{jobId}")
  .onUpdate(async (change) => {
    const after = change.after.data() as Job;
    const before = change.before.data() as Job;
    if (after.status === "queued" && (before.updatedAt !== after.updatedAt)) {
      await handleJob(change.after.ref, after);
    }
  });

async function handleJob(ref: FirebaseFirestore.DocumentReference, job: Job) {
  if (job.scheduledFor && (job.scheduledFor as any).toMillis?.() > Date.now()) return;

  await ref.update({ status: "running", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  const startedAt = Date.now();

  try {
    switch (job.type) {
      case "email.send":
        if (!isEmailPayload(job.payload)) {
          throw new Error(`Invalid email payload: ${JSON.stringify(job.payload)}`);
        }
        await sendEmail(job.payload);
        break;
      case "export.generate":
        await generateExport(job.payload);
        break;
      case "analytics.rollup":
        await runRollup(job.payload);
        break;
      case "webhook.dispatch":
        await dispatchWebhooks(job.type, job.payload);
        break;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }

    await ref.update({ status: "succeeded", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    await db.collection("jobRuns").add({
      jobId: ref.id, startedAt: new Date(startedAt), endedAt: new Date(), result: "ok"
    });

  } catch (err: any) {
    const attempt = (job.attempt ?? 0) + 1;
    const canRetry = attempt < (job.maxAttempts ?? 5);
    if (canRetry) {
      const delay = backoffMs(attempt);
      await ref.update({
        status: "queued",
        attempt,
        scheduledFor: new Date(Date.now() + delay),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      await ref.update({ status: "deadletter", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      await db.collection("deadletters").doc(ref.id).set({
        job, failedAt: new Date(), error: String(err)
      });
    }
  }
}
