import { db, serverTimestamp } from "./admin";
import { genId } from "./util";

export async function appendEvent(jobId: string, type: string, data: any) {
  const eid = genId("evt");
  await db().doc(`jobs/${jobId}/events/${eid}`).set({
    type,
    data: data ?? null,
    createdAt: serverTimestamp()
  }, { merge: true });
}

export async function audit(actor: string | null, action: string, data: any) {
  const id = genId("audit");
  await db().doc(`auditLogs/${id}`).set({
    actor: actor ?? null,
    action,
    data: data ?? null,
    createdAt: serverTimestamp()
  }, { merge: true });
}
