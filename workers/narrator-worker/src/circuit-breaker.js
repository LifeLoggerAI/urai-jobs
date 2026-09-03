"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = void 0;
class CircuitBreaker {
    options;
    failures = 0;
    openedAt = 0;
    state = 'closed';
    constructor(options) {
        this.options = options;
    }
    canCall() {
        if (this.state === 'closed')
            return true;
        if (this.state === 'open' && Date.now() - this.openedAt > this.options.resetAfterMs) {
            this.state = 'half_open';
            return true;
        }
        return this.state === 'half_open';
    }
    recordSuccess() {
        this.failures = 0;
        this.state = 'closed';
    }
    recordFailure() {
        this.failures += 1;
        if (this.failures >= this.options.failureThreshold) {
            this.state = 'open';
            this.openedAt = Date.now();
        }
    }
    snapshot() {
        return {
            state: this.state,
            failures: this.failures,
            openedAt: this.openedAt || null,
        };
    }
}
exports.CircuitBreaker = CircuitBreaker;
