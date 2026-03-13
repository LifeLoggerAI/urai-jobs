
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const db = admin.firestore();

export const verifyJob = functions.firestore
    .document("jobResults/{jobId}")
    .onCreate(async (snap, context) => {
        const result = snap.data();
        const { jobId } = context.params;
        const jobRef = db.collection("jobs").doc(jobId);

        // Basic validation
        if (!result.resultData) {
            functions.logger.error(`Job verification failed: resultData is missing`, { jobId, result });
            
            // Mark job as failed if result is invalid
            await jobRef.update({
                status: "failed",
                error: "Verification failed: resultData is missing",
            });

            // Log error
            await db.collection("jobLogs").add({
                jobId,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                stage: "verification_failed",
                message: `Job ${jobId} verification failed: resultData is missing`,
                result,
            });

            return;
        }

        // Mark job as completed
        await jobRef.update({
            status: "completed",
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        functions.logger.info(`Job verified and marked as completed`, { jobId });

        // Log verification success
        await db.collection("jobLogs").add({
            jobId,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            stage: "verified",
            message: `Job ${jobId} verified and marked as completed`,
        });
    });
