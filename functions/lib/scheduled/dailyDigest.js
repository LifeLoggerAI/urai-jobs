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
exports.scheduledDailyDigest = void 0;
const functions = __importStar(require("firebase-functions"));
const firebase_1 = require("../lib/firebase");
exports.scheduledDailyDigest = functions.pubsub
    .schedule("every 24 hours")
    .onRun(async (context) => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const newApplications = await firebase_1.firestore
        .collection("applications")
        .where("submittedAt", ">=", yesterday)
        .get();
    const pendingApplications = await firebase_1.firestore
        .collection("applications")
        .where("status", "in", ["NEW", "SCREEN"])
        .get();
    const topJobs = await firebase_1.firestore
        .collection("jobs")
        .orderBy("stats.applicantsCount", "desc")
        .limit(5)
        .get();
    const digest = {
        date: now.toISOString().split("T")[0],
        newApplications: newApplications.size,
        pendingApplications: pendingApplications.size,
        topJobs: topJobs.docs.map((doc) => doc.data()),
    };
    await firebase_1.firestore.collection("digests").add(digest);
});
//# sourceMappingURL=dailyDigest.js.map