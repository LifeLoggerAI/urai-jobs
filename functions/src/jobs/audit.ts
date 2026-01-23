
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { JobAuditLogSchema, JobStatus } from "./types";

const db = admin.firestore();

export async function recordAuditLog(
  jobId: string,
  message: string,
  statusChange?: { from: JobStatus; to: JobStatus }
) {
  try {
    const auditData: {
      timestamp: admin.firestore.FieldValue;
      message: string;
      statusChange?: { from: JobStatus; to: JobStatus };
    } = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      message,
    };

    if (statusChange) {
      auditData.statusChange = statusChange;
    }

    const validationResult = JobAuditLogSchema.safeParse(auditData);

    if (!validationResult.success) {
      logger.error(
        `Failed to validate audit log for job ${jobId}`,
        validationResult.error
      );
      // Don't throw an error, just log it. We don't want to fail a job because of an audit log issue.
      return;
    }

    await db
      .collection("jobs")
      .doc(jobId)
      .collection("audit_logs")
      .add(validationResult.data);
  } catch (error) {
    logger.error(`Failed to record audit log for job ${jobId}`, error);
  }
}
