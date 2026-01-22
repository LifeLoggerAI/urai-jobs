import * as functions from 'firebase-functions';

interface LogPayload {
  jobId?: string;
  runId?: string;
  type?: string;
  attempt?: number;
  status?: string;
  timingMs?: number;
  [key: string]: unknown;
}

export const logger = {
  info: (message: string, payload?: LogPayload) => {
    functions.logger.info(message, payload);
  },
  warn: (message: string, payload?: LogPayload) => {
    functions.logger.warn(message, payload);
  },
  error: (message: string, error: Error, payload?: LogPayload) => {
    functions.logger.error(message, { ...payload, error: error.message, stack: error.stack });
  },
};
