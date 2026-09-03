export type StructuredLogPayload = {
  severity?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  event: string;
  message?: string;
  requestId?: string;
  traceId?: string;
  jobId?: string;
  jobType?: string;
  workerName?: string;
  retryCount?: number;
  deploymentVersion?: string;
  environment?: string;
  metadata?: Record<string, unknown>;
};

export function logStructured(payload: StructuredLogPayload): void {
  const entry = {
    timestamp: new Date().toISOString(),
    severity: payload.severity || 'INFO',
    service: 'urai-jobs-runtime',
    environment: payload.environment || process.env.NODE_ENV || 'unknown',
    deploymentVersion:
      payload.deploymentVersion ||
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
