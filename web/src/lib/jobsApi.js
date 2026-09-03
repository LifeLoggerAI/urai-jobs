import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "./firebase";
async function callFunction(name, input) {
    const callable = httpsCallable(getFunctions(firebaseApp, "us-central1"), name);
    const result = await callable(input);
    return result.data;
}
export async function createJob(jobType, payload) {
    return callFunction("createJob", {
        jobType,
        payload
    });
}
export async function listJobs(status, limit = 50) {
    const input = { limit };
    if (status)
        input.status = status;
    return callFunction("listJobsV2", input);
}
export async function getJob(jobId) {
    return callFunction("getJob", { jobId });
}
export async function retryJob(jobId) {
    return callFunction("retryJobV2", { jobId });
}
export async function cancelJob(jobId) {
    return callFunction("cancelJob", { jobId });
}
export async function listJobLogs(jobId, limit = 100) {
    return callFunction("listJobLogsV2", { jobId, limit });
}
export async function processQueueNow(limit = 10) {
    return callFunction("processQueueNow", { limit });
}
export const jobsApi = {
    createJob,
    listJobs,
    getJob,
    retryJob,
    cancelJob,
    listJobLogs,
    processQueueNow
};
