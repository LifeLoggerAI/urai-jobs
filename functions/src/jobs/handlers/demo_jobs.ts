
import * as functions from "firebase-functions";

/**
 * A simple job handler that logs the payload and successfully completes.
 * @param payload The data for the job.
 */
export const echoHandler = async (payload: any): Promise<void> => {
    functions.logger.info("Executing 'echo' job:", { payload });
    // No actual work to do, so we just resolve.
    return Promise.resolve();
};

/**
 * A job handler that waits for a specified duration before completing.
 * This is useful for testing longer-running jobs and lease timeouts.
 * @param payload The data for the job, expecting { ms: number }.
 */
export const waitHandler = async (payload: { ms: number }): Promise<void> => {
    const waitMs = payload?.ms || 1000;
    if (typeof waitMs !== "number" || waitMs <= 0 || waitMs > 30000) {
        throw new Error("Invalid 'ms' payload. Must be a number between 1 and 30000.");
    }

    functions.logger.info(`Executing 'wait' job for ${waitMs}ms.`);
    
    return new Promise(resolve => setTimeout(resolve, waitMs));
};
