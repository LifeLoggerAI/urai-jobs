
import { Timestamp } from "firebase-admin/firestore";

const BASE_DELAY_SECONDS = 15;
const JITTER_FACTOR = 0.2; // 20% jitter

/**
 * Calculates the next run time for a job using exponential backoff with jitter.
 * This helps prevent thundering herd problems and smooths out retries.
 *
 * @param attempts The number of times the job has been attempted (0-indexed).
 * @returns A Firestore Timestamp for when the job should next be run.
 */
export function getNextRunAfter(attempts: number): Timestamp {
    const backoffSeconds = BASE_DELAY_SECONDS * Math.pow(2, attempts);

    // Add jitter to the backoff time
    const jitter = backoffSeconds * JITTER_FACTOR * (Math.random() - 0.5); // +/- 10%
    const totalDelaySeconds = backoffSeconds + jitter;

    const runAfterMillis = Date.now() + totalDelaySeconds * 1000;

    return Timestamp.fromMillis(runAfterMillis);
}
