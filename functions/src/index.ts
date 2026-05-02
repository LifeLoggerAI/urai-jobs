import { withAuthenticatedRole } from './core/auth.js';

import { createJob as createJobHandler } from './jobs/createJob.js';
import { getJobStatus } from './jobs/getJobStatus.js';
import { cancelJob } from './jobs/cancelJob.js';
import { executeJob } from './jobs/executeJob.js';
import { processQueueTick } from './jobs/processQueueTick.js';
import { retryExpiredLeases } from './jobs/retryExpiredLeases.js';
import { cleanupTerminalJobs } from './jobs/cleanupTerminalJobs.js';
import { systemReconcile } from './jobs/systemReconcile.js';
import { onJobTerminalEvent } from './events/onJobTerminalEvent.js';

// Apply RBAC to the createJob function
const createJob = withAuthenticatedRole(['user', 'admin'], createJobHandler);

export {
  createJob,
  getJobStatus,
  cancelJob,
  executeJob,
  processQueueTick,
  retryExpiredLeases,
  cleanupTerminalJobs,
  systemReconcile,
  onJobTerminalEvent,
};
