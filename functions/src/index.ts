import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import fetch from "node-fetch";

function initAdmin() {
  if (admin.apps.length === 0) admin.initializeApp();
  return admin;
}
initAdmin();
const db = admin.firestore();

type JobState =
  | "queued"
  | "claimed"
  | "rendering"
  | "uploaded"
  | "published"
  | "error";

function now() { return Date.now(); }

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

export const health = functions.https.onRequest((_req, res) => {
  res.status(200).send("OK");
});

export const submitJob = functions.https.onRequest(async (req, res) => {
  try {
    const payload = (req.body && typeof req.body === "object") ? req.body : {};
    const jobRef = db.collection("jobs").doc();
    await jobRef.set({
      state: "queued" as JobState,
      createdAt: now(),
      updatedAt: now(),
      request: payload,
    });

    await db.collection("jobEvents").add({
      jobId: jobRef.id,
      state: "queued",
      ts: now(),
    });

    const assetFactoryUrl = requiredEnv("ASSET_FACTORY_URL");

    // Transition: queued -> rendering (optimistic)
    await jobRef.update({ state: "rendering", updatedAt: now() });
    await db.collection("jobEvents").add({ jobId: jobRef.id, state: "rendering", ts: now() });

    // Call asset-factory render endpoint
    const r = await fetch(assetFactoryUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: jobRef.id, ...payload }),
    });

    const j = (await r.json()) as any;
    if (!r.ok || !j || !j.gs) {
      throw new Error(`asset-factory failed (${r.status}): ${JSON.stringify(j)}`);
    }

    // Transition: rendering -> published
    await jobRef.update({
      state: "published",
      updatedAt: now(),
      artifact: {
        gs: String(j.gs),
        meta: j.meta || null,
      },
    });

    await db.collection("jobEvents").add({
      jobId: jobRef.id,
      state: "published",
      ts: now(),
      artifactGs: String(j.gs),
    });

    res.status(200).json({ ok: true, jobId: jobRef.id, artifact: j });
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : "unknown error";
    try {
      // best-effort event log if jobId provided
      const jobId = req.body?.jobId;
      if (jobId) {
        await db.collection("jobEvents").add({ jobId, state: "error", ts: now(), error: msg });
        await db.collection("jobs").doc(jobId).set({ state: "error", updatedAt: now(), error: msg }, { merge: true });
      }
    } catch {}
    res.status(500).json({ ok: false, error: msg });
  }
});
