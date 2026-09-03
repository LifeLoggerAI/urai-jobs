"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = log;
exports.getPort = getPort;
exports.getHost = getHost;
exports.errorMessage = errorMessage;
exports.getRequiredEnv = getRequiredEnv;
exports.validateRequiredEnv = validateRequiredEnv;
exports.requestIdMiddleware = requestIdMiddleware;
exports.asyncHandler = asyncHandler;
exports.errorMiddleware = errorMiddleware;
exports.emitMetric = emitMetric;
const node_crypto_1 = require("node:crypto");
function log(severity, event, fields = {}) {
    const entry = {
        severity,
        event,
        service: process.env.K_SERVICE || 'narrator-worker',
        revision: process.env.K_REVISION,
        timestamp: new Date().toISOString(),
        ...fields,
    };
    const line = JSON.stringify(entry);
    if (severity === 'ERROR')
        console.error(line);
    else if (severity === 'WARN')
        console.warn(line);
    else
        console.log(line);
}
function getPort() {
    return Number(process.env.PORT) || 8080;
}
function getHost() {
    return process.env.HOST || '0.0.0.0';
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function getRequiredEnv(name) {
    const value = process.env[name];
    if (!value)
        throw new Error(`Missing required environment variable: ${name}`);
    return value;
}
function validateRequiredEnv(names) {
    const missing = names.filter((name) => !process.env[name]);
    if (missing.length > 0) {
        log('ERROR', 'startup_env_validation_failed', { missing });
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    log('INFO', 'startup_env_validation_passed', { required: names });
}
function requestIdMiddleware(req, res, next) {
    const headerRequestId = req.header('x-request-id') || req.header('x-correlation-id');
    const requestId = headerRequestId || (0, node_crypto_1.randomUUID)();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
}
function asyncHandler(handler) {
    return (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
}
function errorMiddleware(error, req, res, _next) {
    const requestId = req.requestId;
    log('ERROR', 'http_request_failed', {
        requestId,
        path: req.path,
        method: req.method,
        error: errorMessage(error),
    });
    if (res.headersSent)
        return;
    res.status(500).send({
        error: 'Internal server error.',
        requestId,
    });
}
function emitMetric(name, value, fields = {}) {
    log('INFO', 'runtime_metric', {
        metric: name,
        value,
        ...fields,
    });
}
