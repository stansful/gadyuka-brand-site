import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ADMIN_COOKIE_NAME } from "./auth-constants";
import { adminProxyGate } from "./proxy-gate";
import { deriveSessionKey, signAdminSession } from "./session-token";

const PASSWORD = "test-only-password-0123";
const ORIGIN = "http://localhost:3000";

function request(path: string, init: { method?: string; cookie?: string } = {}): NextRequest {
  const headers = new Headers();
  if (init.cookie) headers.set("cookie", init.cookie);
  return new NextRequest(new URL(path, ORIGIN), { method: init.method ?? "GET", headers });
}

/** NextResponse.next() marks the response with this header; a redirect carries Location instead. */
function passedThrough(response: Response): boolean {
  return response.headers.get("x-middleware-next") === "1";
}

describe("adminProxyGate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lets everything through when ADMIN_PASSWORD is empty outside production (open dev admin)", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(passedThrough(await adminProxyGate(request("/admin/leads")))).toBe(true);
  });

  it("fails closed in production without ADMIN_PASSWORD: pages go to the login page (which explains)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_PASSWORD", "");
    const response = await adminProxyGate(request("/admin/leads"));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/admin/login");
    // the login page itself is reachable (shows the «not configured» notice, no redirect loop)
    expect(passedThrough(await adminProxyGate(request("/admin/login")))).toBe(true);
  });

  it("an open production admin needs the explicit ADMIN_ALLOW_OPEN=1 opt-in", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_PASSWORD", "");
    vi.stubEnv("ADMIN_ALLOW_OPEN", "1");
    expect(passedThrough(await adminProxyGate(request("/admin/leads")))).toBe(true);
  });

  it("redirects a page GET without a session to the login page with a safe `next`", async () => {
    vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
    const response = await adminProxyGate(request("/admin/leads?type=CONTACT"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/admin/login");
    expect(location.searchParams.get("next")).toBe("/admin/leads?type=CONTACT");
  });

  it("redirects /admin itself without a `next` parameter", async () => {
    vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
    const response = await adminProxyGate(request("/admin"));
    expect(response.headers.get("location")).toBe(`${ORIGIN}/admin/login`);
  });

  it("rejects a session signed with another password", async () => {
    vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
    const stale = await signAdminSession(await deriveSessionKey("previous password"));
    const response = await adminProxyGate(request("/admin", { cookie: `${ADMIN_COOKIE_NAME}=${stale}` }));
    expect(response.status).toBe(307);
  });

  it("passes a valid session through", async () => {
    vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
    const token = await signAdminSession(await deriveSessionKey(PASSWORD));
    const response = await adminProxyGate(request("/admin/reviews", { cookie: `${ADMIN_COOKIE_NAME}=${token}` }));
    expect(passedThrough(response)).toBe(true);
  });

  it("binds sessions to ADMIN_SESSION_SECRET (rotating it logs everyone out)", async () => {
    vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
    vi.stubEnv("ADMIN_SESSION_SECRET", "b".repeat(64));
    const oldSecretToken = await signAdminSession(await deriveSessionKey(PASSWORD, "a".repeat(64)));
    expect((await adminProxyGate(request("/admin", { cookie: `${ADMIN_COOKIE_NAME}=${oldSecretToken}` }))).status).toBe(307);
    const token = await signAdminSession(await deriveSessionKey(PASSWORD, "b".repeat(64)));
    expect(passedThrough(await adminProxyGate(request("/admin", { cookie: `${ADMIN_COOKIE_NAME}=${token}` })))).toBe(true);
  });

  it("never gates the login page or POSTs (Server Actions authorize themselves)", async () => {
    vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
    expect(passedThrough(await adminProxyGate(request("/admin/login")))).toBe(true);
    expect(passedThrough(await adminProxyGate(request("/admin/reviews", { method: "POST" })))).toBe(true);
  });
});
