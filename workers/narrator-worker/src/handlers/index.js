"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleJob = handleJob;
const narrator_tts_js_1 = require("./narrator-tts.js");
async function handleJob(job) {
    const jobType = job.type || job.jobType;
    switch (jobType) {
        case 'narrator.tts':
            return (0, narrator_tts_js_1.handleNarratorTts)(job);
        default:
            throw new Error(`Unknown job type: ${jobType || 'missing'}`);
    }
}
