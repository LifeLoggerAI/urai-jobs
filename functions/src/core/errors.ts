import { https } from 'firebase-functions';

/**
 * A custom error class for internal use. Can be used to bubble up specific
 * error conditions within the backend before they are transformed into a 
 * user-facing HttpsError.
 */
export class URAI_Error extends Error {
  constructor(public readonly code: string, public readonly category: string, message: string) {
    super(message);
    Object.setPrototypeOf(this, URAI_Error.prototype);
  }
}

/**
 * Creates a standard Firebase HttpsError that can be thrown from a callable function.
 * This is the canonical way to send errors back to the client.
 */
export function httpsError(
  code: https.FunctionsErrorCode,
  message: string,
  details?: any
): https.HttpsError {
  return new https.HttpsError(code, message, details);
}

/**
 * Logs an error to the console with structured details.
 * This should be used in all catch blocks.
 */
export function logError(error: unknown, context?: Record<string, any>): void {
  const logEntry: Record<string, any> = { 
    ...context,
    timestamp: new Date().toISOString(),
  };

  if (error instanceof https.HttpsError) {
    logEntry.error = {
      type: 'HttpsError',
      code: error.code,
      message: error.message,
      details: error.details,
    };
  } else if (error instanceof URAI_Error) {
    logEntry.error = {
      type: 'URAI_Error',
      code: error.code,
      category: error.category,
      message: error.message,
      stack: error.stack,
    };
  } else if (error instanceof Error) {
    logEntry.error = {
      type: 'Error',
      message: error.message,
      stack: error.stack,
    };
  } else {
    logEntry.error = {
      type: 'Unknown',
      details: error,
    };
  }
  
  console.error(JSON.stringify(logEntry, null, 2));
}
