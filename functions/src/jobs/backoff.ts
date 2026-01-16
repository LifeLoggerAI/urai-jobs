
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60 * 1000;
const JITTER_FACTOR = 0.5;

export function calculateBackoff(attempts: number): number {
    const backoff = Math.min(MAX_BACKOFF_MS, INITIAL_BACKOFF_MS * Math.pow(2, attempts));
    const jitter = Math.round(Math.random() * backoff * JITTER_FACTOR);
    return backoff + jitter;
}
