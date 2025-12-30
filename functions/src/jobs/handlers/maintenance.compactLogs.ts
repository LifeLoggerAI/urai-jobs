
import { z } from 'zod';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const CompactLogsPayload = z.object({
  jobRunsDaysToKeep: z.number().int().min(1).optional(),
  auditLogsDaysToKeep: z.number().int().min(1).optional(),
});

export const maintenanceCompactLogs = async (payload: unknown) => {
  const validation = CompactLogsPayload.safeParse(payload);
  if (!validation.success) {
    throw new Error(`Invalid payload: ${validation.error.message}`);
  }

  const { jobRunsDaysToKeep = 30, auditLogsDaysToKeep = 90 } = validation.data;
  const now = new Date();

  let deletedJobRuns = 0;
  let deletedAuditLogs = 0;

  // Compact Job Runs
  const jobRunsCutoff = new Date(now.setDate(now.getDate() - jobRunsDaysToKeep));
  const oldJobRuns = await admin.firestore().collection('jobRuns')
    .where('endedAt', '<', jobRunsCutoff)
    .limit(500) // Process in batches to avoid high memory usage
    .get();

  if (!oldJobRuns.empty) {
    const batch = admin.firestore().batch();
    oldJobRuns.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deletedJobRuns = oldJobRuns.size;
    functions.logger.info(`Deleted ${deletedJobRuns} old job runs.`);
  }

  // Compact Audit Logs
  const auditLogsCutoff = new Date(now.setDate(now.getDate() - auditLogsDaysToKeep));
  const oldAuditLogs = await admin.firestore().collection('auditLogs')
    .where('at', '<', auditLogsCutoff)
    .limit(500)
    .get();

  if (!oldAuditLogs.empty) {
    const batch = admin.firestore().batch();
    oldAuditLogs.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deletedAuditLogs = oldAuditLogs.size;
    functions.logger.info(`Deleted ${deletedAuditLogs} old audit logs.`);
  }

  return {
    success: true,
    deleted: {
      jobRuns: deletedJobRuns,
      auditLogs: deletedAuditLogs,
    },
  };
};
