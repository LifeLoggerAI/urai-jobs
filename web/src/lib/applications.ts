import { collection, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import type { ApplicationRecord } from "../types/Application";

// --- READ operations can still use direct access for performance ---

export async function getMyApplications(userId: string): Promise<ApplicationRecord[]> {
  const q = query(
    collection(db, "applications"),
    where("userId", "==", userId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<ApplicationRecord, "id">),
  }));
}

// --- WRITE operations MUST go through secure backend callable functions ---

type SubmitPayload = { jobId: string; resumeUrl?: string | null };
const submitCallable = httpsCallable<SubmitPayload, { id: string; duplicate: boolean }>(functions, "submitApplication");

export async function submitApplication(payload: SubmitPayload) {
  const result = await submitCallable(payload);
  return result.data;
}
