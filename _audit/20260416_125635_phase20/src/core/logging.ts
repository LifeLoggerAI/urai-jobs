import * as admin from 'firebase-admin';
import { LogLevel, LogSource } from './types.js';

const db = admin.firestore();

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
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to create log:', error);
  }
};
