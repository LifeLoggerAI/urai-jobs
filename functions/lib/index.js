"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitJob = exports.health = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const node_fetch_1 = __importDefault(require("node-fetch"));
function initAdmin() {
    if (admin.apps.length === 0)
        admin.initializeApp();
    return admin;
}
initAdmin();
const db = admin.firestore();
function now() { return Date.now(); }
function requiredEnv(name) {
    const v = process.env[name];
    if (!v)
        throw new Error(`Missing required env: ${name}`);
    return v;
}
exports.health = functions.https.onRequest((_req, res) => {
    res.status(200).send("OK");
});
exports.submitJob = functions.https.onRequest(async (req, res) => {
    try {
        const payload = (req.body && typeof req.body === "object") ? req.body : {};
        const jobRef = db.collection("jobs").doc();
        await jobRef.set({
            state: "queued",
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
        const r = await (0, node_fetch_1.default)(assetFactoryUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ jobId: jobRef.id, ...payload }),
        });
        const j = (await r.json());
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
    }
    catch (e) {
        const msg = e?.message ? String(e.message) : "unknown error";
        try {
            // best-effort event log if jobId provided
            const jobId = req.body?.jobId;
            if (jobId) {
                await db.collection("jobEvents").add({ jobId, state: "error", ts: now(), error: msg });
                await db.collection("jobs").doc(jobId).set({ state: "error", updatedAt: now(), error: msg }, { merge: true });
            }
        }
        catch { }
        res.status(500).json({ ok: false, error: msg });
    }
});
//# sourceMappingURL=index.js.map