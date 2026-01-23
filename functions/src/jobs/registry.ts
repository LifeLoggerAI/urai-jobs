import { z } from 'zod';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const JOB_REGISTRY = {
  'health.ping': {
    id: 'health.ping',
    version: 1,
    description: 'A simple job to check if the system is healthy.',
    defaultQueue: 'default',
    handler: async (payload: { message: string }) => {
      await db.collection('systemHealthPings').add({ ...payload, receivedAt: new Date() });
      return { received: true };
    },
    validate: z.object({
      message: z.string(),
    }),
    timeoutSeconds: 60,
    maxAttempts: 3,
    backoff: 'exponential',
  },
  'metrics.rollupDaily': {
    id: 'metrics.rollupDaily',
    version: 1,
    description: 'Rolls up daily metrics for the jobs system.',
    defaultQueue: 'default',
    handler: async (payload: any) => {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const snapshot = await db.collection('jobRuns').where('timestamp', '>', yesterday).get();
      const runs = snapshot.docs.map(doc => doc.data());

      const stats = runs.reduce((acc, run) => {
        acc[run.jobId] = acc[run.jobId] || { succeeded: 0, failed: 0, dead: 0 };
        acc[run.jobId][run.status]++;
        return acc;
      }, {});

      const date = today.toISOString().split('T')[0];
      await db.collection('metricsDaily').doc(date).set({ stats, updatedAt: new Date() });

      return { success: true };
    },
    validate: z.object({}),
    timeoutSeconds: 300,
    maxAttempts: 2,
    backoff: 'exponential',
  },
  'assetFactory.renderDemo': {
    id: 'assetFactory.renderDemo',
    version: 1,
    description: 'Simulates a multi-step asset rendering pipeline.',
    defaultQueue: 'default',
    handler: async (payload: { userId: string, sceneId: string }) => {
      const renderJobRef = db.collection('renderJobs').doc();
      await renderJobRef.set({ ...payload, progress: 0, state: 'starting' });

      await new Promise(resolve => setTimeout(resolve, 1000));
      await renderJobRef.update({ progress: 33, state: 'step_1_complete' });

      await new Promise(resolve => setTimeout(resolve, 1000));
      await renderJobRef.update({ progress: 66, state: 'step_2_complete' });

      await new Promise(resolve => setTimeout(resolve, 1000));
      await renderJobRef.update({ progress: 100, state: 'step_3_complete' });

      return { success: true };
    },
    validate: z.object({
      userId: z.string(),
      sceneId: z.string(),
    }),
    timeoutSeconds: 600,
    maxAttempts: 1,
    backoff: 'exponential',
  },
};
