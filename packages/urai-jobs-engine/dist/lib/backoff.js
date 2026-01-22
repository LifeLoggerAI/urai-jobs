"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backoff = backoff;
const MIN_BACKOFF_MS = 15 * 1000; // 15 seconds
const MAX_BACKOFF_MS = 30 * 60 * 1000; // 30 minutes
function backoff(attempt) {
    const backoff = MIN_BACKOFF_MS * Math.pow(2, attempt);
    const jitter = Math.random() * MIN_BACKOFF_MS;
    return Math.min(backoff + jitter, MAX_BACKOFF_MS);
}
