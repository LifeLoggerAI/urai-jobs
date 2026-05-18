"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logStructured = logStructured;
function logStructured(payload) {
    const entry = {
        timestamp: new Date().toISOString(),
        severity: payload.severity || 'INFO',
        service: 'urai-jobs-runtime',
        environment: payload.environment || process.env.NODE_ENV || 'unknown',
        deploymentVersion: payload.deploymentVersion ||
            process.env.K_REVISION ||
            process.env.GIT_SHA ||
            'unknown',
        event: payload.event,
        message: payload.message,
        requestId: payload.requestId,
        traceId: payload.traceId,
        jobId: payload.jobId,
        jobType: payload.jobType,
        workerName: payload.workerName,
        retryCount: payload.retryCount || 0,
        metadata: payload.metadata || {},
    };
    console.log(JSON.stringify(entry));
}
