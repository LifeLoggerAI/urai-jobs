/**
 * AUTOFIX: minimal shared types for functions build.
 * Keep this file small + valid so TS can't brick the project.
 */

export type WorkerResult =
  | { ok: true; result?: any }
  | { ok: false; error: any };

export type ApplicationSource =
  | string
  | { type?: string; refCode?: string; [k: string]: any };

export type Application = {
  id?: string;
  jobId?: string;
  applicantId?: string;
  source?: ApplicationSource;
  [k: string]: any;
};
