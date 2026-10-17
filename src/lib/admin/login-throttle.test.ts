import { describe, expect, it } from "vitest";
import { LoginThrottle } from "./login-throttle";

describe("LoginThrottle", () => {
  it("blocks after maxFailures within the window and unblocks after it", () => {
    const throttle = new LoginThrottle({ maxFailures: 3, windowMs: 1000 });
    const start = 10_000;
    throttle.recordFailure("ip", start);
    throttle.recordFailure("ip", start + 1);
    expect(throttle.retryAfterMs("ip", start + 2)).toBe(0);
    throttle.recordFailure("ip", start + 2);
    expect(throttle.retryAfterMs("ip", start + 3)).toBe(997);
    expect(throttle.retryAfterMs("other-ip", start + 3)).toBe(0);
    expect(throttle.retryAfterMs("ip", start + 1000)).toBe(0);
  });

  it("reset() clears the counter after a successful login", () => {
    const throttle = new LoginThrottle({ maxFailures: 1, windowMs: 1000 });
    throttle.recordFailure("ip", 0);
    expect(throttle.retryAfterMs("ip", 1)).toBeGreaterThan(0);
    throttle.reset("ip");
    expect(throttle.retryAfterMs("ip", 1)).toBe(0);
  });

  it("evicts the oldest key when full", () => {
    const throttle = new LoginThrottle({ maxFailures: 1, windowMs: 1000, maxKeys: 2 });
    throttle.recordFailure("a", 0);
    throttle.recordFailure("b", 0);
    throttle.recordFailure("c", 0);
    expect(throttle.retryAfterMs("a", 1)).toBe(0);
    expect(throttle.retryAfterMs("c", 1)).toBeGreaterThan(0);
  });
});
