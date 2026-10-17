import { beforeAll, describe, expect, it } from "vitest";
import {
  ADMIN_SESSION_TTL_SECONDS,
  deriveSessionKey,
  safeEqual,
  signAdminSession,
  verifyAdminSession,
} from "./session-token";

describe("admin session token", () => {
  let key: Uint8Array;
  beforeAll(async () => {
    key = await deriveSessionKey("correct horse battery staple");
  });

  it("verifies a freshly signed token", async () => {
    const token = await signAdminSession(key);
    expect(await verifyAdminSession(token, key)).toBe(true);
  });

  it("rejects a token signed with another password (password change logs everyone out)", async () => {
    const token = await signAdminSession(await deriveSessionKey("old password"));
    expect(await verifyAdminSession(token, key)).toBe(false);
  });

  it("derives the key with scrypt bound to the server secret (memoized, deterministic)", async () => {
    const password = "correct horse battery staple";
    expect(await deriveSessionKey(password)).toEqual(key);
    expect(deriveSessionKey(password, "s1")).toBe(deriveSessionKey(password, "s1"));
    const withSecret = await deriveSessionKey(password, "s1");
    expect(withSecret).toHaveLength(32);
    expect(withSecret).not.toEqual(key);
    expect(await deriveSessionKey(password, "s2")).not.toEqual(withSecret);
    const token = await signAdminSession(withSecret);
    expect(await verifyAdminSession(token, key)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const issuedAt = Date.UTC(2026, 0, 1);
    const token = await signAdminSession(key, issuedAt);
    expect(await verifyAdminSession(token, key, issuedAt + 60_000)).toBe(true);
    expect(await verifyAdminSession(token, key, issuedAt + (ADMIN_SESSION_TTL_SECONDS + 60) * 1000)).toBe(false);
  });

  it("rejects tampered, empty and oversized tokens", async () => {
    const token = await signAdminSession(key);
    const [header, payload, signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ role: "admin", sub: "admin", exp: 9_999_999_999 })).toString("base64url");
    expect(await verifyAdminSession(`${header}.${forgedPayload}.${signature}`, key)).toBe(false);
    expect(await verifyAdminSession(`${header}.${payload}.`, key)).toBe(false);
    expect(await verifyAdminSession("", key)).toBe(false);
    expect(await verifyAdminSession("x".repeat(5000), key)).toBe(false);
    expect(await verifyAdminSession("not-a-jwt", key)).toBe(false);
  });

  it("rejects an unsigned (alg: none) token", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ role: "admin", sub: "admin", iss: "gadyuka-admin", aud: "gadyuka-admin", exp: 9_999_999_999 }),
    ).toString("base64url");
    expect(await verifyAdminSession(`${header}.${payload}.`, key)).toBe(false);
  });
});

describe("safeEqual", () => {
  it("compares strings of any length", () => {
    expect(safeEqual("secret", "secret")).toBe(true);
    expect(safeEqual("secret", "Secret")).toBe(false);
    expect(safeEqual("secret", "secret-longer")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
    expect(safeEqual("пароль", "пароль")).toBe(true);
  });
});
