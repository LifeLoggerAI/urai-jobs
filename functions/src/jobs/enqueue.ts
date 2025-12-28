import * as admin from "firebase-admin";
import type { Job, JobType } from "./types";
const db = admin.firestore();

export async function enqueue(type: JobType, payload: any = {}, opts?: {
  priority?: number; maxAttempts?: number; scheduledFor?: Date | null; createdBy?: string;
}) {
  const doc: Job = {
    type,
    status: "queued",
    payload,
    priority: opts?.priority ?? 5,
    attempt: 0,
    maxAttempts: opts?.maxAttempts ?? 5,
    scheduledFor: opts?.scheduledFor ?? null,
    createdBy: opts?.createdBy ?? "system"
  };
  const ref = await db.collection("jobs").add({
    ...doc,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return ref.id;
}