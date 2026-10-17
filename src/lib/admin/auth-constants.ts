/**
 * Admin auth constants shared by src/lib/admin/auth.ts (server components, actions,
 * route handlers) and the proxy gate (src/lib/admin/proxy-gate.ts). No runtime imports,
 * so it is safe to load from src/proxy.ts.
 */

export const ADMIN_COOKIE_NAME = "gadyuka_admin";
/** The cookie is only sent to /admin/** (pages, actions and admin route handlers). */
export const ADMIN_COOKIE_PATH = "/admin";
export const ADMIN_LOGIN_PATH = "/admin/login";
