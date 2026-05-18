"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRetryDecision = calculateRetryDecision;
const DEFAULT_BASE_DELAY_MS = 1_000;
const DEFAULT_MAX_DELAY_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 3;
function calculateRetryDecision(input) {
    const attemptCount = input.attemptCount || 0;
    const maxAttempts = input.maxAttempts || DEFAULT_MAX_ATTEMPTS;
    const baseDelayMs = input.baseDelayMs || DEFAULT_BASE_DELAY_MS;
    const maxDelayMs = input.maxDelayMs || DEFAULT_MAX_DELAY_MS;
    if (attemptCount >= maxAttempts) {
        return {
            shouldRetry: false,
            nextDelayMs: 0,
            reason: 'max_attempts_exhausted',
        };
    }
    if (input.errorClass === 'validation_error' || input.errorClass === 'unauthorized') {
        return {
            shouldRetry: false,
            nextDelayMs: 0,
            reason: 'non_retryable_error',
        };
    }
    const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * 2 ** attemptCount);
    const jitter = Math.floor(Math.random() * Math.min(1_000, exponentialDelay));
    return {
        shouldRetry: true,
        nextDelayMs: exponentialDelay + jitter,
        reason: 'retry_scheduled',
    };
}
