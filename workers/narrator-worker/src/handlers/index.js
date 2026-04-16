"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleJob = handleJob;
const narrator_tts_1 = require("./narrator-tts");
async function handleJob(job) {
    switch (job.jobType) {
        case 'narrator.tts':
            return (0, narrator_tts_1.handleNarratorTts)(job);
        default:
            throw new Error(`Unknown job type: ${job.jobType}`);
    }
}
