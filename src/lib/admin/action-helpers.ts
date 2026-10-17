import "server-only";
import { unstable_rethrow } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { actionFail, type ActionResult } from "./action-result";
import { AdminAuthError, requireAdminAction } from "./auth";

/**
 * Wraps the body of every admin Server Action:
 *  1. authorizes the caller (requireAdminAction — never trust that the form was rendered for an admin);
 *  2. maps known failures to Russian messages (auth, Prisma unique/FK/not-found);
 *  3. logs unexpected errors server-side and returns a generic message (no stack traces to the client).
 * Next.js control-flow errors (redirect, notFound) are re-thrown.
 */
export async function adminAction<T>(label: string, run: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    await requireAdminAction();
    return await run();
  } catch (error: unknown) {
    unstable_rethrow(error);
    if (error instanceof AdminAuthError) {
      return actionFail("Сессия истекла. Обновите страницу и войдите снова.");
    }
    const known = describePrismaError(error);
    if (known) return actionFail(known);
    console.error(`[admin] action "${label}" failed:`, error);
    return actionFail("Не удалось выполнить действие. Попробуйте ещё раз.");
  }
}

function describePrismaError(error: unknown): string | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;
  switch (error.code) {
    case "P2002":
      return "Запись с таким значением уже существует (проверьте адрес / slug).";
    case "P2003":
      return "Операция невозможна: запись связана с другими данными.";
    case "P2025":
      return "Запись не найдена — возможно, её уже удалили. Обновите страницу.";
    default:
      return null;
  }
}

/** Ids from `ids` that do not exist as Media rows (to report a stale picker instead of an FK error). */
export async function findMissingMediaIds(ids: ReadonlyArray<string | null | undefined>): Promise<string[]> {
  const wanted = [...new Set(ids.filter((id): id is string => typeof id === "string"))];
  if (wanted.length === 0) return [];
  const rows = await db.media.findMany({ where: { id: { in: wanted } }, select: { id: true } });
  const found = new Set(rows.map((row) => row.id));
  return wanted.filter((id) => !found.has(id));
}

export const MISSING_MEDIA_MESSAGE = "Выбранное изображение не найдено в медиатеке — выберите другое.";
