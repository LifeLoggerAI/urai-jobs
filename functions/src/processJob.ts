import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const db = admin.firestore();

export const processJob = functions.firestore
    .document("jobs/{jobId}")
    .onCreate(async (snap, context) => {
        const job = snap.data();
        const { jobId } = context.params;

        // Update status to processing
        await snap.ref.update({ status: "processing" });

        functions.logger.info(`Processing job`, { jobId, job });

        // Log job start
        await db.collection("jobLogs").add({
            jobId,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            stage: "processing",
            message: `Job ${jobId} started`,
        });

        try {
            // Simulate job execution based on type
            let resultData;
            switch (job.type) {
                case "data_enrichment":
                    resultData = { ...job.payload, enriched: true };
                    break;
                case "ai_analysis":
                    resultData = { ...job.payload, analysis: "completed" };
                    break;
                case "asset_generation":
                    resultData = { ...job.payload, assetUrl: "https://example.com/asset.png" };
                    break;
                case "analytics_aggregation":
                    resultData = { ...job.payload, aggregation: "done" };
                    break;
                default:
                    throw new Error(`Unknown job type: ${job.type}`);
            }

            // Store result, which will trigger the verifyJob function
            await db.collection("jobResults").doc(jobId).set({
                jobId,
                resultData,
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            functions.logger.info(`Job processing finished, result stored for verification.`, { jobId });

            // Log successful processing
            await db.collection("jobLogs").add({
                jobId,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                stage: "processing_success",
                message: `Job ${jobId} processing finished successfully, awaiting verification.`,
            });
        } catch (error) {
            functions.logger.error(`Error processing job`, { jobId, error, job });

            // Update job status to failed
            await snap.ref.update({
                status: "failed",
                error: error.message,
            });

            // Log job failure
            await db.collection("jobLogs").add({
                jobId,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                stage: "failed",
                message: `Job ${jobId} failed during processing`,
                errorStack: error.stack,
            });
        }
    });
