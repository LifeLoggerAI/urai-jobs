export type LogSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export type LogFields = Record<string, unknown>;

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
