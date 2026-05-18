"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const express_1 = __importDefault(require("express"));
const index_js_1 = require("./handlers/index.js");
const concurrency_governor_js_1 = require("./concurrency-governor.js");
const structured_logger_js_1 = require("./structured-logger.js");
const runtime_js_1 = require("./runtime.js");
(0, runtime_js_1.validateRequiredEnv)([]);
const app = (0, express_1.default)();
const governor = new concurrency_governor_js_1.ConcurrencyGovernor({
    maxConcurrentJobs: Number(process.env.WORKER_MAX_CONCURRENT_JOBS || 8),
    saturationThreshold: Number(process.env.WORKER_SATURATION_THRESHOLD || 0.9),
});
app.use(express_1.default.json({ limit: '1mb' }));
app.use(runtime_js_1.requestIdMiddleware);
app.get('/', (_req, res) => {
    res.status(200).send({ service: 'narrator-worker', ok: true });
});
app.get('/healthz', (_req, res) => {
    res.status(200).send({ ok: true, governor: governor.getStats() });
});
app.post('/execute-job', (0, runtime_js_1.asyncHandler)(async (req, res) => {
    const jobId = req.body?.jobId || req.body?.id;
    const jobType = req.body?.type || req.body?.jobType;
    const requestId = req.requestId;
    if (!governor.canAcceptJob()) {
        const stats = governor.getStats();
        (0, runtime_js_1.emitMetric)('worker_saturation_rejections_total', 1, {
            jobId,
            jobType,
            requestId,
            ...stats,
        });
        (0, structured_logger_js_1.logStructured)({
            severity: 'WARN',
            event: 'worker.saturated',
            requestId,
            jobId,
            jobType,
            workerName: 'narrator-worker',
            metadata: stats,
        });
        res.status(429).send({
            error: 'Worker saturated.',
            requestId,
            retryAfterSeconds: 30,
        });
        return;
    }
    governor.acquire();
    const startedAt = Date.now();
    (0, structured_logger_js_1.logStructured)({
        severity: 'INFO',
        event: 'job.execution.started',
        requestId,
        jobId,
        jobType,
        workerName: 'narrator-worker',
        metadata: governor.getStats(),
    });
    try {
        const result = await (0, index_js_1.handleJob)(req.body);
        (0, runtime_js_1.emitMetric)('job_execution_duration_ms', Date.now() - startedAt, {
            jobId,
            jobType,
            requestId,
        });
        (0, structured_logger_js_1.logStructured)({
            severity: 'INFO',
            event: 'job.execution.completed',
            requestId,
            jobId,
            jobType,
            workerName: 'narrator-worker',
            metadata: {
                durationMs: Date.now() - startedAt,
                governor: governor.getStats(),
            },
        });
        res.status(200).send(result);
    }
    catch (error) {
        (0, runtime_js_1.emitMetric)('job_execution_failures_total', 1, {
            jobId,
            jobType,
            requestId,
        });
        (0, structured_logger_js_1.logStructured)({
            severity: 'ERROR',
            event: 'job.execution.failed',
            requestId,
            jobId,
            jobType,
            workerName: 'narrator-worker',
            metadata: {
                error: error instanceof Error ? error.message : String(error),
                durationMs: Date.now() - startedAt,
                governor: governor.getStats(),
            },
        });
        throw error;
    }
    finally {
        governor.release();
        (0, runtime_js_1.emitMetric)('worker_saturation', governor.getSaturation(), {
            workerName: 'narrator-worker',
            requestId,
        });
    }
}));
app.use(runtime_js_1.errorMiddleware);
const port = (0, runtime_js_1.getPort)();
const host = (0, runtime_js_1.getHost)();
app.listen(port, host, () => {
    (0, structured_logger_js_1.logStructured)({
        severity: 'INFO',
        event: 'worker.started',
        workerName: 'narrator-worker',
        metadata: {
            host,
            port,
            governor: governor.getStats(),
        },
    });
});
