"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailydigest = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-admin/firestore");
const v2_1 = require("firebase-functions/v2");
const firebase_1 = require("../lib/firebase");
exports.dailydigest = (0, scheduler_1.onSchedule)("every 24 hours", async () => {
    const now = firestore_1.Timestamp.now();
    const twentyFourHoursAgo = firestore_1.Timestamp.fromMillis(now.toMillis() - 24 * 60 * 60 * 1000);
    const newApplications = await firebase_1.db
        .collection("applications")
        .where("submittedAt", ">=", twentyFourHoursAgo)
        .count()
        .get();
    const pendingNew = await firebase_1.db
        .collection("applications")
        .where("status", "==", "NEW")
        .count()
        .get();
    const pendingScreen = await firebase_1.db
        .collection("applications")
        .where("status", "==", "SCREEN")
        .count()
        .get();
    const topJobs = await firebase_1.db
        .collection("jobs")
        .orderBy("stats.applicantsCount", "desc")
        .limit(5)
        .get();
    const digest = {
        createdAt: now,
        newApplicationsLast24h: newApplications.data().count,
        pendingNewCount: pendingNew.data().count,
        pendingScreenCount: pendingScreen.data().count,
        topJobs: topJobs.docs.map((doc) => ({ id: doc.id, title: doc.data().title, applicants: doc.data().stats.applicantsCount })),
    };
    const date = new Date().toISOString().split("T")[0];
    await firebase_1.db.collection("digests").doc(date).set(digest);
    v2_1.logger.info(`Daily digest for ${date} created successfully.`);
});
