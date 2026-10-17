/**
 * Which access mode the admin runs in — read from the environment on EVERY request
 * (never at module load, so `next build` works without admin secrets).
 *
 *   ADMIN_PASSWORD set              → "password": a signed session cookie is required.
 *   ADMIN_PASSWORD empty, dev/test  → "open": everyone may use the admin (yellow banner).
 *   ADMIN_PASSWORD empty, production→ "locked" (fail closed), unless ADMIN_ALLOW_OPEN=1
 *                                     explicitly opts into an open admin.
 *   production + password shorter than ADMIN_PASSWORD_MIN_LENGTH, or ADMIN_SESSION_SECRET
 *   set but shorter than ADMIN_SESSION_SECRET_MIN_LENGTH → "locked".
 *
 * No runtime imports: used by src/proxy.ts (via proxy-gate.ts) and src/lib/admin/auth.ts.
 */

export const ADMIN_PASSWORD_MIN_LENGTH = 16;
export const ADMIN_SESSION_SECRET_MIN_LENGTH = 32;

export type AdminLockReason = "missing-password" | "weak-password" | "weak-session-secret";

export type AdminGate =
  | { kind: "open" }
  | { kind: "password"; password: string; sessionSecret: string }
  | { kind: "locked"; reason: AdminLockReason };

export type AdminGateEnv = {
  NODE_ENV?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_ALLOW_OPEN?: string;
  ADMIN_SESSION_SECRET?: string;
};

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function currentEnv(): AdminGateEnv {
  return {
    NODE_ENV: process.env.NODE_ENV,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    ADMIN_ALLOW_OPEN: process.env.ADMIN_ALLOW_OPEN,
    ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
  };
}

export function resolveAdminGate(env: AdminGateEnv = currentEnv()): AdminGate {
  const production = env.NODE_ENV === "production";
  const password = env.ADMIN_PASSWORD ?? "";
  const sessionSecret = (env.ADMIN_SESSION_SECRET ?? "").trim();

  if (password.length > 0) {
    if (production && password.length < ADMIN_PASSWORD_MIN_LENGTH) return { kind: "locked", reason: "weak-password" };
    if (production && sessionSecret.length > 0 && sessionSecret.length < ADMIN_SESSION_SECRET_MIN_LENGTH) {
      return { kind: "locked", reason: "weak-session-secret" };
    }
    return { kind: "password", password, sessionSecret };
  }

  const allowOpen = TRUE_VALUES.has((env.ADMIN_ALLOW_OPEN ?? "").trim().toLowerCase());
  if (!production || allowOpen) return { kind: "open" };
  return { kind: "locked", reason: "missing-password" };
}

/** Russian explanation for the login page / login form. */
export const ADMIN_LOCK_MESSAGES: Readonly<Record<AdminLockReason, string>> = {
  "missing-password":
    "Админка закрыта: на сервере не задан ADMIN_PASSWORD. Впишите пароль в .env и перезапустите приложение (DEPLOY.md, раздел 7).",
  "weak-password": `Админка закрыта: ADMIN_PASSWORD слишком короткий — нужно не меньше ${ADMIN_PASSWORD_MIN_LENGTH} символов. Задайте новый пароль в .env и перезапустите приложение.`,
  "weak-session-secret": `Админка закрыта: ADMIN_SESSION_SECRET короче ${ADMIN_SESSION_SECRET_MIN_LENGTH} символов. Сгенерируйте новый (openssl rand -hex 32) и перезапустите приложение.`,
};
