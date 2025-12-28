export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export const backoffMs = (attempt: number) => Math.min(60_000, 2 ** attempt * 1000);