import { describe, expect, it } from "vitest";
import { ADMIN_LOCK_MESSAGES, resolveAdminGate } from "./admin-gate";

const STRONG = "x".repeat(16);

describe("resolveAdminGate", () => {
  it("dev/test without a password: open", () => {
    expect(resolveAdminGate({ NODE_ENV: "development", ADMIN_PASSWORD: "" })).toEqual({ kind: "open" });
    expect(resolveAdminGate({ NODE_ENV: "test" })).toEqual({ kind: "open" });
  });

  it("production without a password fails closed unless ADMIN_ALLOW_OPEN=1", () => {
    expect(resolveAdminGate({ NODE_ENV: "production", ADMIN_PASSWORD: "" })).toEqual({
      kind: "locked",
      reason: "missing-password",
    });
    expect(resolveAdminGate({ NODE_ENV: "production", ADMIN_ALLOW_OPEN: "0" })).toMatchObject({ kind: "locked" });
    expect(resolveAdminGate({ NODE_ENV: "production", ADMIN_ALLOW_OPEN: "1" })).toEqual({ kind: "open" });
    expect(resolveAdminGate({ NODE_ENV: "production", ADMIN_ALLOW_OPEN: " true " })).toEqual({ kind: "open" });
  });

  it("password mode; production requires at least 16 characters", () => {
    expect(resolveAdminGate({ NODE_ENV: "production", ADMIN_PASSWORD: "short" })).toEqual({
      kind: "locked",
      reason: "weak-password",
    });
    expect(resolveAdminGate({ NODE_ENV: "production", ADMIN_PASSWORD: STRONG })).toEqual({
      kind: "password",
      password: STRONG,
      sessionSecret: "",
    });
    // dev: any length (tests, local work)
    expect(resolveAdminGate({ NODE_ENV: "development", ADMIN_PASSWORD: "dev" })).toMatchObject({ kind: "password" });
  });

  it("a password always wins over ADMIN_ALLOW_OPEN", () => {
    expect(resolveAdminGate({ NODE_ENV: "production", ADMIN_PASSWORD: STRONG, ADMIN_ALLOW_OPEN: "1" })).toMatchObject({
      kind: "password",
    });
  });

  it("rejects a too short ADMIN_SESSION_SECRET in production", () => {
    expect(
      resolveAdminGate({ NODE_ENV: "production", ADMIN_PASSWORD: STRONG, ADMIN_SESSION_SECRET: "tiny" }),
    ).toEqual({ kind: "locked", reason: "weak-session-secret" });
    expect(
      resolveAdminGate({ NODE_ENV: "production", ADMIN_PASSWORD: STRONG, ADMIN_SESSION_SECRET: "s".repeat(64) }),
    ).toEqual({ kind: "password", password: STRONG, sessionSecret: "s".repeat(64) });
  });

  it("has a Russian explanation for every lock reason", () => {
    for (const message of Object.values(ADMIN_LOCK_MESSAGES)) expect(message).toMatch(/^Админка закрыта/);
  });
});
