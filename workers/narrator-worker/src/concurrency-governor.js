"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConcurrencyGovernor = void 0;
const DEFAULT_CONFIG = {
    maxConcurrentJobs: 8,
    saturationThreshold: 0.9,
};
class ConcurrencyGovernor {
    activeJobs = 0;
    config;
    constructor(config) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...(config || {}),
        };
    }
    canAcceptJob() {
        return this.activeJobs < this.config.maxConcurrentJobs;
    }
    acquire() {
        this.activeJobs += 1;
    }
    release() {
        this.activeJobs = Math.max(0, this.activeJobs - 1);
    }
    getSaturation() {
        return this.activeJobs / this.config.maxConcurrentJobs;
    }
    isSaturated() {
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
exports.ConcurrencyGovernor = ConcurrencyGovernor;
