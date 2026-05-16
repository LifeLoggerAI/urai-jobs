import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";
import { LogLevel, LogSource } from './types.js';

if (getApps().length === 0) initializeApp();

const db = getFirestore();

const stripUndefined = (value: unknown): unknown => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefined(item))
      .filter((item) => item !== undefined);
  }
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      const sanitized = stripUndefined(nestedValue);
      if (sanitized !== undefined) output[key] = sanitized;
    }
    return output;
  }
  return value;
};

export const createLog = async (
  tenantId: string | undefined | null,
  level: LogLevel,
  source: LogSource,
  event: string,
  message: string,
  context?: object
) => {
  try {
    const logData: Record<string, unknown> = {
      level,
      source,
      event,
      message,
      timestamp: FieldValue.serverTimestamp(),
    };

    if (tenantId) logData.tenantId = tenantId;

    const sanitizedContext = stripUndefined(context);
    if (sanitizedContext !== undefined) logData.context = sanitizedContext;

    await db.collection('logs').add(logData);
  } catch (error) {
    console.error('Failed to create log:', error);
  }
};
