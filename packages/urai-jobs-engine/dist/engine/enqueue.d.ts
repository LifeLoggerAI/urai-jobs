import { z } from 'zod';
declare const JobPayload: z.ZodObject<{
    type: z.ZodString;
    payload: z.ZodAny;
    idempotencyKey: z.ZodString;
    scheduledFor: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    type: string;
    idempotencyKey: string;
    payload?: any;
    scheduledFor?: Date | undefined;
}, {
    type: string;
    idempotencyKey: string;
    payload?: any;
    scheduledFor?: Date | undefined;
}>;
export declare function enqueueJob(jobData: z.infer<typeof JobPayload>): Promise<string>;
export {};
