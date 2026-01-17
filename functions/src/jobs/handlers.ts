
import { Job } from "./types";
import { logger } from "firebase-functions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JobHandler = (job: Job<any>) => Promise<void>;

const handlers: Record<string, JobHandler> = {
  async echo(job: Job<{ message: string }>) {
    logger.info(`ECHO JOB HANDLER: ${job.id} says "${job.payload.message}"`);
  },

  async wait(job: Job<{ ms: number }>) {
    const ms = job.payload.ms || 1000;
    if (ms > 10000 || ms < 0) {
      throw new Error("Wait time must be between 0 and 10000ms.");
    }
    logger.info(`WAIT JOB HANDLER: ${job.id} waiting for ${ms}ms...`);
    await new Promise(resolve => setTimeout(resolve, ms));
    logger.info(`WAIT JOB HANDLER: ${job.id} finished waiting.`);
  },
};

export default handlers;
