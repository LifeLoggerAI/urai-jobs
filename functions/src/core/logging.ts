import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";
import { LogLevel, LogSource } from './types.js';

if (getApps().length === 0) initializeApp();

const db = getFirestore();

export const createLog = async (
  tenantId: string,
  level: LogLevel,
  source: LogSource,
  event: string,
  message: string,
  context?: object
) => {
  try {
    await db.collection('logs').add({
      tenantId,
      level,
      source,
      event,
      message,
      context,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to create log:', error);
  }
};
