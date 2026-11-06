import type { NextFunction, Request, Response } from 'express';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

export type LogSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export type LogFields = Record<string, unknown>;

export type RuntimeRequest = Request & {
  requestId?: string;
};

export function log(severity: LogSeverity, event: string, fields: LogFields = {}) {
  const entry = {
    severity,
    event,
    service: process.env.K_SERVICE || 'narrator-worker',
    revision: process.env.K_REVISION,
    timestamp: new Date().toISOString(),
    ...fields,
  };

  const line = JSON.stringify(entry);
  if (severity === 'ERROR') console.error(line);
  else if (severity === 'WARN') console.warn(line);
  else console.log(line);
}

export function getPort() {
  return Number(process.env.PORT) || 8080;
}

export function getHost() {
  return process.env.HOST || '0.0.0.0';
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function validateRequiredEnv(names: string[]) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    log('ERROR', 'startup_env_validation_failed', { missing });
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  log('INFO', 'startup_env_validation_passed', { required: names });
}

export function requestIdMiddleware(req: RuntimeRequest, res: Response, next: NextFunction) {
  const headerRequestId = req.header('x-request-id') || req.header('x-correlation-id');
  const requestId = headerRequestId || randomUUID();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  next();
}

export function requireWorkerAuth(req: RuntimeRequest, res: Response, next: NextFunction) {
  const expectedToken = process.env.URAI_JOBS_WORKER_TOKEN;
  const env = String(process.env.URAI_ENV || process.env.NODE_ENV || 'local').toLowerCase();
  // Emulator and test traffic must prove the same dedicated bearer identity.
  // An absent or blank secret is never permission to access a media worker.
  if (!expectedToken || !expectedToken.trim()) {
    log('ERROR', 'worker_auth_missing_token', { requestId: req.requestId, env });
    res.status(503).send({ ok: false, error: 'worker auth is not configured', requestId: req.requestId });
    return;
  }

  const header = req.header('authorization') || '';
  const expectedHash = createHash('sha256').update(`Bearer ${expectedToken}`).digest();
  const actualHash = createHash('sha256').update(header).digest();
  if (!timingSafeEqual(actualHash, expectedHash)) {
    log('WARN', 'worker_auth_denied', { requestId: req.requestId, env });
    res.status(401).send({ ok: false, error: 'unauthorized', requestId: req.requestId });
    return;
  }

  next();
}

export function asyncHandler(
  handler: (req: RuntimeRequest, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: RuntimeRequest, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function errorMiddleware(error: unknown, req: RuntimeRequest, res: Response, _next: NextFunction) {
  const requestId = req.requestId;

  log('ERROR', 'http_request_failed', {
    requestId,
    path: req.path,
    method: req.method,
    error: errorMessage(error),
  });

  if (res.headersSent) return;

  res.status(500).send({
    error: 'Internal server error.',
    requestId,
  });
}

export function emitMetric(name: string, value: number, fields: LogFields = {}) {
  log('INFO', 'runtime_metric', {
    metric: name,
    value,
    ...fields,
  });
}
