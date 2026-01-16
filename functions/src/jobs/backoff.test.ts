
import { calculateBackoff } from './backoff';

describe('calculateBackoff', () => {
    it('should return a value within the expected range', () => {
        const attempt = 3;
        const baseDelay = 1000;
        const maxDelay = 30000;
        const backoff = calculateBackoff(attempt, baseDelay, maxDelay);

        const expectedMin = baseDelay;
        const expectedMax = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));

        expect(backoff).toBeGreaterThanOrEqual(expectedMin);
        expect(backoff).toBeLessThanOrEqual(expectedMax);
    });

    it('should not exceed the maxDelay', () => {
        const attempt = 10;
        const baseDelay = 1000;
        const maxDelay = 5000;
        const backoff = calculateBackoff(attempt, baseDelay, maxDelay);

        expect(backoff).toBeLessThanOrEqual(maxDelay);
    });
});
