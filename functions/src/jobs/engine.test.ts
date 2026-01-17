
import { expect } from "chai";
import "mocha";
import { getNextRunAfter } from "./core";

describe("Job Engine Core", () => {
  describe("getNextRunAfter", () => {
    it("should produce a date in the future", () => {
      const nextRun = getNextRunAfter(1);
      expect(nextRun.getTime()).to.be.greaterThan(Date.now());
    });

    it("should increase backoff exponentially", () => {
      // Get baseline delays, ignoring jitter for theoretical check
      const t1_ms = getNextRunAfter(1).getTime() - Date.now();
      const t2_ms = getNextRunAfter(2).getTime() - Date.now();
      const t3_ms = getNextRunAfter(3).getTime() - Date.now();
      
      // Allow for jitter by checking for a factor > 1.5 instead of exactly 2
      expect(t2_ms).to.be.greaterThan(t1_ms * 1.5);
      expect(t3_ms).to.be.greaterThan(t2_ms * 1.5);
    });

    it("should handle the first attempt (attempts=0)", () => {
      const nextRun = getNextRunAfter(0);
      const delay = nextRun.getTime() - Date.now();
      // baseDelaySeconds * 2^0 * (1+jitter)
      expect(delay).to.be.closeTo(15000, 3000); // 15s +/- 20%
    });
  });
});
