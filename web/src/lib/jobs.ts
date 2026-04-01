import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import type { Job } from "../types/Job";

// --- READ operations can still use direct access for performance ---
const jobsRef = collection(db, "jobs");

export async function listJobs(max = 25): Promise<Job[]> {
  const q = query(jobsRef, orderBy("createdAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Job, "id">),
  }));
}

export async function getJob(jobId: string): Promise<Job | null> {
  const snap = await getDoc(doc(db, "jobs", jobId));
  if (!snap.exists()) return null;
  return {
    id: snap.id,
    ...(snap.data() as Omit<Job, "id">),
  };
}


// --- WRITE operations MUST go through secure backend callable functions ---

type CreatePayload = { title: string; company: string; description: string; };
const createJobCallable = httpsCallable<CreatePayload, { id: string }>(functions, "createJob");

export async function createJob(input: CreatePayload) {
  const result = await createJobCallable(input);
  return result.data.id;
}

type UpdatePayload = { jobId: string; title: string; company: string; description: string; };
const updateJobCallable = httpsCallable<UpdatePayload, { id: string }>(functions, "updateJob");

export async function updateJob(input: UpdatePayload) {
  const result = await updateJobCallable(input);
  return result.data.id;
}

type DeletePayload = { jobId: string };
const deleteJobCallable = httpsCallable<DeletePayload, { id: string }>(functions, "deleteJob");

export async function deleteJob(input: DeletePayload) {
  const result = await deleteJobCallable(input);
  return result.data.id;
}
