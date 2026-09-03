export type CircuitState = 'closed' | 'open' | 'half_open';

export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  private state: CircuitState = 'closed';

  constructor(
    private readonly options: {
      failureThreshold: number;
      resetAfterMs: number;
    }
  ) {}

  canCall(): boolean {
    if (this.state === 'closed') return true;

    if (this.state === 'open' && Date.now() - this.openedAt > this.options.resetAfterMs) {
      this.state = 'half_open';
      return true;
    }

    return this.state === 'half_open';
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
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
