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
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledDailyDigest = exports.httpHealth = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const date_fns_1 = require("date-fns");
const db = admin.firestore();
exports.httpHealth = functions.https.onRequest((request, response) => {
    response.status(200).send({ status: "ok", timestamp: new Date().toISOString() });
});
exports.scheduledDailyDigest = functions.pubsub
    .schedule("0 9 * * 1-5") // 9 AM on weekdays
    .timeZone("America/New_York")
    .onRun(async (context) => {
    const today = (0, date_fns_1.startOfDay)(new Date());
    const yesterday = (0, date_fns_1.sub)(today, { days: 1 });
    const newAppsSnap = await db
        .collection("applications")
        .where("submittedAt", ">=", yesterday)
        .where("submittedAt", "<", today)
        .get();
    const pendingAppsSnap = await db
        .collection("applications")
        .where("status", "in", ["NEW", "SCREEN"])
        .get();
    const digestId = today.toISOString().split("T")[0]; // YYYY-MM-DD
    await db.collection("digests").doc(digestId).set({
        createdAt: context.timestamp,
        newApplicationsLast24h: newAppsSnap.size,
        pendingReviewCount: pendingAppsSnap.size,
    }, { merge: true });
    functions.logger.info(`Daily digest ${digestId} created successfully.`);
});
//# sourceMappingURL=http.js.map