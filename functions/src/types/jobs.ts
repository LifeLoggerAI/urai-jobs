import { z } from "zod";

export const JobSchema = z.object({
  jobId: z.string(),
  kind: z.string(),
  status: z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELED"]),
  priority: z.number(),
  attempt: z.number(),
  maxAttempts: z.number(),
  input: z.any(),
  output: z.any().optional(),
  lockedUntil: z.date().optional(),
  lockedBy: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Job = z.infer<typeof JobSchema>;
