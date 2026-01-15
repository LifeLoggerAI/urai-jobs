"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onjobwrite = void 0;
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("firebase-admin/firestore");
const db = (0, firestore_1.getFirestore)();
exports.onjobwrite = v2_1.firestore.onDocumentWritten("jobs/{jobId}", async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    const jobId = event.params.jobId;
    const jobPublicRef = db.collection("jobPublic").doc(jobId);
    if (afterData?.status === "open") {
        const jobPublic = {
            title: afterData.title,
            department: afterData.department,
            locationType: afterData.locationType,
            locationText: afterData.locationText,
            employmentType: afterData.employmentType,
            descriptionMarkdown: afterData.descriptionMarkdown,
            requirements: afterData.requirements,
            niceToHave: afterData.niceToHave,
            compensationRange: afterData.compensationRange,
            status: "open",
            createdAt: afterData.createdAt,
            updatedAt: afterData.updatedAt,
        };
        await jobPublicRef.set(jobPublic, { merge: true });
    }
    else {
        if (beforeData?.status === "open") {
            await jobPublicRef.delete();
        }
    }
});
