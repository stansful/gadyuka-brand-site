import { z } from "zod";
import type { FieldErrors } from "./action-result";

/**
 * zod parsing with Russian error messages (per-parse error map — the global zod
 * config is left untouched, the public site uses its own messages).
 * Schema-level custom messages still win over the locale map.
 */
const russianErrors = z.locales.ru().localeError;

export type ParseOutcome<T> = { success: true; data: T } | { success: false; fieldErrors: FieldErrors; message: string };

export function parseInput<S extends z.ZodType>(schema: S, input: unknown): ParseOutcome<z.output<S>> {
  const result = schema.safeParse(input, { error: russianErrors });
  if (result.success) return { success: true, data: result.data };
  const fieldErrors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.map((segment) => String(segment)).join(".") || "_form";
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return { success: false, fieldErrors, message: "Проверьте поля формы — есть ошибки" };
}
