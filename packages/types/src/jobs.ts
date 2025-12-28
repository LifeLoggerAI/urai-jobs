export type Job = { id?: string; title: string; status: 'open'|'closed'|'draft'; team?: string; location?: string; compensation?: string; description?: string; createdAt?: any; };
export type Application = { id?: string; jobId: string; fullName: string; email: string; phone?: string; links?: string[]; coverLetter?: string; resumePath?: string; source?: string; createdAt?: any; score?: number; uid?: string; };
export type QueueJob = { id?: string; type: string; status: 'queued'|'running'|'done'|'error'; payload?: any; scheduledAt?: any; attempts?: number; createdAt?: any; };
