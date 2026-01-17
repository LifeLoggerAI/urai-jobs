
/**
 * Defines the context object that is passed to every job handler.
 */
export interface JobHandlerContext {
    jobId: string;      // The ID of the job being executed.
    workerId: string;   // The ID of the worker that claimed this job.
}

/**
 * Defines the shape of a job handler function.
 * @param payload The data/payload associated with the job.
 * @param context Contextual information about the job execution.
 */
export type JobHandler = (payload: any, context: JobHandlerContext) => Promise<void>;

/**
 * A map where keys are job types (strings) and values are the corresponding
 * handler functions.
 */
export type JobHandlerMap = {
    [jobType: string]: JobHandler;
};  
