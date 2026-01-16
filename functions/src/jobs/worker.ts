import { Job } from "./types";
import { completeJob, failJob } from "./engine";

// Job handler registry
const jobHandlers: Record<string, (payload: any) => Promise<any>> = {
    renderCinematic: async (payload) => {
        console.log("Rendering cinematic:", payload);
        return { success: true };
    },
    sendEmailDigest: async (payload) => {
        console.log("Sending email digest:", payload);
        return { success: true };
    },
    rebuildIndexes: async (payload) => {
        console.log("Rebuilding indexes:", payload);
        return { success: true };
    }
};

export const runJob = async (job: Job) => {
    const handler = jobHandlers[job.type];
    if (!handler) {
        await failJob(job.id!, "unknown-run-id", { message: `No handler for job type ${job.type}` }, "scheduled-worker");
        return;
    }

    try {
        const result = await handler(job.payload);
        await completeJob(job.id!, "unknown-run-id", result, "scheduled-worker");
    } catch (error: any) {
        await failJob(job.id!, "unknown-run-id", { message: error.message, stack: error.stack }, "scheduled-worker");
    }
};
