"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNarratorTtsJob = createNarratorTtsJob;
const shared_types_1 = require("../shared-types");
const jobs_1 = require("../core/jobs");
async function createNarratorTtsJob(payload, ownerId) {
    const validationResult = shared_types_1.NarratorTtsPayloadSchema.safeParse(payload);
    if (!validationResult.success) {
        throw new Error('Invalid narrator.tts payload: ' + validationResult.error.message);
    }
    return (0, jobs_1.createJob)('narrator.tts', validationResult.data, ownerId);
}
