import { firestore } from 'firebase-admin';
import { AuditEvent, AuditEventSchema } from './types/jobs';

const db = firestore();
const auditCollection = db.collection('jobAudit');

export const writeAuditEvent = async (event: AuditEvent): Promise<void> => {
  const validatedEvent = AuditEventSchema.parse(event);
  await auditCollection.doc(validatedEvent.eventId).set(validatedEvent);
};
