export type ConcurrencyGovernorConfig = {
  maxConcurrentJobs: number;
  saturationThreshold: number;
};

const DEFAULT_CONFIG: ConcurrencyGovernorConfig = {
  maxConcurrentJobs: 8,
  saturationThreshold: 0.9,
};

export class ConcurrencyGovernor {
  private activeJobs = 0;
  private readonly config: ConcurrencyGovernorConfig;

  constructor(config?: Partial<ConcurrencyGovernorConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...(config || {}),
    };
  }

  canAcceptJob(): boolean {
    return this.activeJobs < this.config.maxConcurrentJobs;
  }

  acquire(): void {
    this.activeJobs += 1;
  }

  release(): void {
    this.activeJobs = Math.max(0, this.activeJobs - 1);
  }

  getSaturation(): number {
    return this.activeJobs / this.config.maxConcurrentJobs;
  }

  isSaturated(): boolean {
    return this.getSaturation() >= this.config.saturationThreshold;
  }

  getStats() {
    return {
      activeJobs: this.activeJobs,
      maxConcurrentJobs: this.config.maxConcurrentJobs,
      saturation: this.getSaturation(),
      saturated: this.isSaturated(),
    };
  }
}
