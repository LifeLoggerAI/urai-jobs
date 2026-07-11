import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { PubSub } from '@google-cloud/pubsub';
import { ulid } from 'ulid';
import type { Job, JobQueueEntry, JobQueueStatus, JobLease } from '@urai-jobs/shared-types';
import { jobDoc, jobQueueEntryDoc } from '../core/firestore-paths.js';
import { canRequeueUnstartedLease, isTerminalJobStatus } from './executionGuards.js';

const MAX_JOBS_TO_LEASE_PER_TICK = 10;
const JOB_EXECUTION_TOPIC = process.env.PUBSUB_JOB_EXECUTION_TOPIC || 'job-execution';
const LEASE_DURATION_MS = 60 * 1000;

const pubsub = new PubSub();

function createLease(workerId: string): JobLease {
  const leaseId = ulid();
  const leaseToken = ulid();
  const now = new Date();

  return {
    leaseId,
    leaseToken,
    workerId,
    expires