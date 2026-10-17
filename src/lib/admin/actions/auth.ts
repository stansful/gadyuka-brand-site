"use server";

import { redirect } from "next/navigation";
import { ADMIN_LOCK_MESSAGES } from "../admin-gate";
import { ADMIN_LOGIN_PATH, clearAdminSession, loginWithPassword } from "../auth";
import type { LoginState } from "../login-state";

/** Only same-app admin paths are allowed as the post-login target (no open redirects). */
function safeNextPath(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/admin";
  if (!/^\/admin(?:[/?#]|$)/.test(value) || value.startsWith("//") || value.includes("\\")) return "/admin";
  if (value.startsWith(ADMIN_LOGIN_PATH)) return "/admin";
  return value;
}

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0) {
    return { error: "Введите пароль" };
  }
  if (password.length > 512) return { error: "Неверный пароль" };

  const outcome = await loginWithPassword(password);
  if (!outcome.ok) {
    switch (outcome.reason) {
      // The admin is open (dev without a password, or ADMIN_ALLOW_OPEN=1): nothing to log into.
      case "disabled":
        return redirect("/admin");
      // Locked (production without a usable password): explain instead of redirecting —
      // /admin would only send the user back here.
      case "locked":
        return { error: ADMIN_LOCK_MESSAGES[outcome.lockReason] };
      case "throttled": {
        const minutes = Math.max(1, Math.ceil((outcome.retryAfterMs ?? 60_000) / 60_000));
        return { error: `Слишком много попыток. Попробуйте через ${minutes} мин.` };
      }
      case "invalid":
        return { error: "Неверный пароль" };
    }
  }
  redirect(safeNextPath(formData.get("next")));
}

export async function logoutAction(): Promise<void> {
  await clearAdminSession();
  redirect(ADMIN_LOGIN_PATH);
}
