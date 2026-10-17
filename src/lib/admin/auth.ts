import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getClientIp } from "@/lib/rate-limit";
import { type AdminLockReason, resolveAdminGate } from "./admin-gate";
import { ADMIN_COOKIE_NAME, ADMIN_COOKIE_PATH, ADMIN_LOGIN_PATH } from "./auth-constants";
import { LoginThrottle } from "./login-throttle";
import {
  ADMIN_SESSION_TTL_SECONDS,
  deriveSessionKey,
  safeEqual,
  signAdminSession,
  verifyAdminSession,
} from "./session-token";

/**
 * Admin access control — the ONE place that decides whether a request may use the admin.
 *
 * The mode comes from resolveAdminGate() (src/lib/admin/admin-gate.ts), read per request:
 * - ADMIN_PASSWORD set    → a valid signed session cookie is required (mode "password").
 * - ADMIN_PASSWORD empty  → dev/test: open to everyone (mode "open", yellow banner);
 *                           production: LOCKED (fail closed) unless ADMIN_ALLOW_OPEN=1.
 *
 * Optimistic layer: src/proxy.ts → adminProxyGate() redirects page GETs without a valid
 * session to the login page (real 307, nothing renders). It is NOT the security boundary.
 *
 * Enforcement points (never rely on the layout alone — pages render in parallel with
 * layouts and Server Actions / Route Handlers are reachable by direct POST):
 *   requireAdminPage()    — admin layout + every admin data query (src/lib/admin/queries.ts)
 *   requireAdminAction()  — every Server Action (via adminAction() in action-helpers.ts)
 *   requireAdminRoute()   — every admin Route Handler (src/app/admin/api/**)
 */

export { ADMIN_COOKIE_NAME, ADMIN_COOKIE_PATH, ADMIN_LOGIN_PATH };

export type AdminAccess =
  | { allowed: true; mode: "open" | "password" }
  /** `locked`: the admin cannot be used at all until the server is configured (no login possible). */
  | { allowed: false; locked: AdminLockReason | null };
export type GrantedAdminAccess = Extract<AdminAccess, { allowed: true }>;

/** Per-request (React cache) access check. Always reads cookies, so callers are request-time. */
export const getAdminAccess = cache(async (): Promise<AdminAccess> => {
  const cookieStore = await cookies();
  const gate = resolveAdminGate();
  if (gate.kind === "open") return { allowed: true, mode: "open" };
  if (gate.kind === "locked") return { allowed: false, locked: gate.reason };
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return { allowed: false, locked: null };
  const valid = await verifyAdminSession(token, await deriveSessionKey(gate.password, gate.sessionSecret));
  return valid ? { allowed: true, mode: "password" } : { allowed: false, locked: null };
});

export class AdminAuthError extends Error {
  constructor() {
    super("Требуется вход в админку");
    this.name = "AdminAuthError";
  }
}

/** Pages / layouts / data queries: redirects to the login page when access is denied. */
export async function requireAdminPage(): Promise<GrantedAdminAccess> {
  const access = await getAdminAccess();
  if (!access.allowed) redirect(ADMIN_LOGIN_PATH);
  return access;
}

/** Server Actions: throws AdminAuthError (adminAction() turns it into a Russian error result). */
export async function requireAdminAction(): Promise<GrantedAdminAccess> {
  const access = await getAdminAccess();
  if (!access.allowed) throw new AdminAuthError();
  return access;
}

/**
 * Route Handlers: returns an error Response (403 cross-site, 401 no session) or null when allowed.
 *   const denied = await requireAdminRoute(request); if (denied) return denied;
 */
export async function requireAdminRoute(request: Request): Promise<Response | null> {
  if (request.method !== "GET" && request.method !== "HEAD" && !isSameOriginRequest(request)) {
    return Response.json({ error: "Запрос с другого сайта отклонён" }, { status: 403 });
  }
  const access = await getAdminAccess();
  if (!access.allowed) {
    return Response.json({ error: "Требуется вход в админку" }, { status: 401 });
  }
  return null;
}

/** CSRF guard for mutating Route Handlers (Server Actions have their own Origin check). */
export function isSameOriginRequest(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host.split(",")[0]?.trim();
  } catch {
    return false;
  }
}

// ── login / logout (used by src/lib/admin/actions/auth.ts) ─────────────────────

const loginThrottle = new LoginThrottle({ maxFailures: 10, windowMs: 15 * 60 * 1000 });

/**
 * Throttle key: the same trusted client-IP helper as the lead rate limit (X-Real-IP set by
 * Caddy from the TCP peer, then the LAST X-Forwarded-For hop). Requests without any IP
 * header (only possible without the reverse proxy, i.e. local dev) share one bucket.
 */
async function clientKey(): Promise<string> {
  return getClientIp(await headers()) ?? "unknown";
}

export type LoginOutcome =
  | { ok: true }
  | { ok: false; reason: "disabled" | "invalid" | "throttled"; retryAfterMs?: number }
  | { ok: false; reason: "locked"; lockReason: AdminLockReason };

/** Checks the password (constant time, throttled) and sets the session cookie on success. */
export async function loginWithPassword(input: string): Promise<LoginOutcome> {
  const gate = resolveAdminGate();
  if (gate.kind === "open") return { ok: false, reason: "disabled" };
  if (gate.kind === "locked") return { ok: false, reason: "locked", lockReason: gate.reason };
  const { password, sessionSecret } = gate;

  const key = await clientKey();
  const retryAfterMs = loginThrottle.retryAfterMs(key);
  if (retryAfterMs > 0) return { ok: false, reason: "throttled", retryAfterMs };

  if (!safeEqual(input, password)) {
    loginThrottle.recordFailure(key);
    // Small fixed delay to slow down guessing even below the throttle limit.
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { ok: false, reason: "invalid" };
  }

  loginThrottle.reset(key);
  const token = await signAdminSession(await deriveSessionKey(password, sessionSecret));
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: ADMIN_COOKIE_PATH,
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });
  return { ok: true };
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete({ name: ADMIN_COOKIE_NAME, path: ADMIN_COOKIE_PATH });
}
