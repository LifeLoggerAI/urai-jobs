
import { expect } from "chai";

describe("Backoff", () => {
  it("should calculate backoff correctly", () => {
    const backoff = (attempt: number) => Math.pow(2, attempt) * 1000;

    expect(backoff(0)).to.equal(1000);
    expect(backoff(1)).to.equal(2000);
    expect(backoff(2)).to.equal(4000);
    expect(backoff(3)).to.equal(8000);
  });
});
