"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = void 0;
const log = (level, message, job, extra) => {
    console.log(JSON.stringify({
        severity: level.toUpperCase(),
        message,
        jobId: job.id,
        jobType: job.type,
        traceId: job.traceId,
        ...extra
    }));
};
exports.log = log;
