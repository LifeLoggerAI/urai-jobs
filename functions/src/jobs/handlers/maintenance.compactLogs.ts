
import {z} from "zod";
import * as admin from "firebase-admin";
import {Timestamp} from "firebase-admin/firestore";
import {logger} from "firebase-functions";
import {Handler} from "../../../types";

const CompactLogsPayloadSchema = z.object({
  daysToKeep: z.number().int().min(1).default(30),
  batchSize: z.number().int().min(1).max(500).default(100),
});

export const compactLogs: Handler = async (payload) => {
  const {daysToKeep, batchSize} = CompactLogsPayloadSchema.parse(payload);
  const cutoff = Timestamp.fromMillis(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

  let deletedCount = 0;
  let batches = 0;

  const collections = ["jobRuns", "auditLogs"];

  for (const collection of collections) {
    while (true) {
      const query = admin.firestore().collection(collection)
          .where("at", "<", cutoff)
          .limit(batchSize);

      const snap = await query.get();
      if (snap.empty) {
        break;
      }

      const batch = admin.firestore().batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();

      deletedCount += snap.size;
      batches++;

      if (snap.size < batchSize) {
        break; // Last batch for this collection
      }
    }
  }

  const result = {deletedCount, batches, daysToKeep};
  logger.info("Log compaction complete", result);
  return result;
};
