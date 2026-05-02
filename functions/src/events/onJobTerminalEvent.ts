import * as functions from 'firebase-functions/v1';
import { createLog } from '../core/logging.js';

export const onJobTerminalEvent = functions.firestore
  .document('jobs/{jobId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    const terminalStates = ['SUCCESS', 'FAILED', 'DEAD', 'CANCELLED'];

    if (!terminalStates.includes(before.status) && terminalStates.includes(after.status)) {
      // This is a terminal event, emit it!
      const eventPayload = {
        jobId: after.id,
        rootJobId: after.rootJobId,
        correlationId: after.correlationId,
        type: after.type,
        status: after.status,
        targetSystem: after.target?.system,
        tenantId: after.tenantId,
        progress: after.progress,
        resultRef: after.result?.resultId,
        errorCode: after.error?.code,
        emittedAt: new Date().toISOString(),
      };

      // TODO: Use a reliable event bus like Pub/Sub for fanning out events.
      // For now, we'll just log it.
      await createLog(
        after.tenantId,
        'INFO',
        'TRIGGER',
        'JobTerminalEvent',
        `Job ${after.id} reached terminal state: ${after.status}`,
        eventPayload
      );
    }
  });
