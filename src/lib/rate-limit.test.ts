import { describe, expect, it, vi } from "vitest";
import {
  checkRateLimit,
  getClientIp,
  getIpHashSalt,
  hashIp,
  IpHashSaltError,
  LEAD_RATE_LIMIT,
  rateLimitKey,
  rateLimitNetwork,
} from "./rate-limit";

describe("hashIp", () => {
  it("is HMAC-SHA256(key = salt, ip) in hex", () => {
    // printf '203.0.113.7' | openssl dgst -sha256 -hmac pepper
    expect(hashIp("203.0.113.7", "pepper")).toBe("f9a092447a622340f8af8ffa67cff0602a7c010205f2a3617d8d6f2ca2392edc");
  });

  it("is deterministic and salt-dependent, and never contains the IP", () => {
    const a = hashIp("203.0.113.7", "salt-1");
    expect(hashIp("203.0.113.7", "salt-1")).toBe(a);
    expect(hashIp("203.0.113.7", "salt-2")).not.toBe(a);
    expect(hashIp("203.0.113.8", "salt-1")).not.toBe(a);
    expect(a).not.toContain("203");
  });

  it("normalizes case and whitespace of the IP", () => {
    expect(hashIp(" 2001:DB8::1 ", "s")).toBe(hashIp("2001:db8::1", "s"));
  });
});

describe("getClientIp", () => {
  it("prefers X-Real-IP (set by Caddy)", () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.4", "x-forwarded-for": "10.0.0.1, 198.51.100.9" });
    expect(getClientIp(headers)).toBe("198.51.100.4");
  });

  it("uses the last X-Forwarded-For hop when X-Real-IP is missing", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 198.51.100.9" }))).toBe("198.51.100.9");
  });

  it("strips ports and brackets, rejects garbage", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "203.0.113.7:51234" }))).toBe("203.0.113.7");
    expect(getClientIp(new Headers({ "x-real-ip": "[2001:db8::1]:443" }))).toBe("2001:db8::1");
    expect(getClientIp(new Headers({ "x-real-ip": "<script>" }))).toBeNull();
    expect(getClientIp(new Headers())).toBeNull();
  });

  it("puts requests without an IP into one shared bucket", () => {
    expect(rateLimitKey(new Headers(), "s")).toBe(hashIp("unknown", "s"));
    expect(rateLimitKey(new Headers({ "x-real-ip": "198.51.100.4" }), "s")).toBe(hashIp("198.51.100.4", "s"));
  });

  it("keys IPv6 clients by their /64 (address rotation inside a subscriber prefix does not help)", () => {
    const a = rateLimitKey(new Headers({ "x-real-ip": "2001:db8:1:2:aaaa::1" }), "s");
    const b = rateLimitKey(new Headers({ "x-real-ip": "2001:db8:1:2:ffff:ffff:ffff:ffff" }), "s");
    const otherPrefix = rateLimitKey(new Headers({ "x-real-ip": "2001:db8:1:3::1" }), "s");
    expect(a).toBe(b);
    expect(otherPrefix).not.toBe(a);
  });
});

describe("rateLimitNetwork", () => {
  it("keeps IPv4, maps IPv4-mapped IPv6 back to IPv4", () => {
    expect(rateLimitNetwork("203.0.113.7")).toBe("203.0.113.7");
    expect(rateLimitNetwork("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(rateLimitNetwork("::FFFF:cb00:7107")).toBe("203.0.113.7");
  });

  it("reduces IPv6 to the /64 prefix, whatever the notation", () => {
    expect(rateLimitNetwork("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(rateLimitNetwork("2001:0DB8:0000:0000:0000:0000:0000:0001")).toBe("2001:db8:0:0::/64");
    expect(rateLimitNetwork("2001:db8:1:2:3:4:5:6")).toBe("2001:db8:1:2::/64");
    expect(rateLimitNetwork("2001:db8:1:2::")).toBe("2001:db8:1:2::/64");
    expect(rateLimitNetwork("::1")).toBe("0:0:0:0::/64");
    expect(rateLimitNetwork("64:ff9b::198.51.100.4")).toBe("64:ff9b:0:0::/64");
  });
});

describe("getIpHashSalt", () => {
  it("returns a configured salt of at least 16 characters", () => {
    expect(getIpHashSalt({ IP_HASH_SALT: "  0123456789abcdef  ", NODE_ENV: "production" })).toBe("0123456789abcdef");
  });

  it("fails closed in production when the salt is missing or short", () => {
    expect(() => getIpHashSalt({ NODE_ENV: "production" })).toThrow(IpHashSaltError);
    expect(() => getIpHashSalt({ IP_HASH_SALT: "short", NODE_ENV: "production" })).toThrow(IpHashSaltError);
  });

  it("falls back to a dev-only salt outside production (with one warning)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getIpHashSalt({ NODE_ENV: "development" }).length).toBeGreaterThan(0);
    expect(getIpHashSalt({ IP_HASH_SALT: "short", NODE_ENV: "test" })).toBe("short");
    expect(warn.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

describe("checkRateLimit", () => {
  const now = new Date("2026-10-16T12:00:00.000Z");

  it("allows up to the limit within the window", async () => {
    const count = vi.fn(async () => LEAD_RATE_LIMIT.max - 1);
    const result = await checkRateLimit("hash", { count, now });
    expect(result).toEqual({ limited: false, remaining: 0 });
    expect(count).toHaveBeenCalledWith("hash", new Date(now.getTime() - LEAD_RATE_LIMIT.windowMs));
  });

  it("blocks the 6th lead in 10 minutes and computes Retry-After from the oldest lead", async () => {
    const oldest = new Date(now.getTime() - 4 * 60 * 1000); // 4 min ago → frees up in 6 min
    const result = await checkRateLimit("hash", {
      count: async () => 5,
      oldestInWindow: async () => oldest,
      now,
    });
    expect(result).toEqual({ limited: true, retryAfterSeconds: 6 * 60 });
  });

  it("falls back to the full window when the oldest lead is unknown", async () => {
    const result = await checkRateLimit("hash", { count: async () => 9, now });
    expect(result).toEqual({ limited: true, retryAfterSeconds: LEAD_RATE_LIMIT.windowMs / 1000 });
  });
});
