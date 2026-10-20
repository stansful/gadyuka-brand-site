import { z } from 'zod';

import type { FieldErrors } from './action-result';

import { errorKey, type AdminTranslator, type AdminValidationKey } from './i18n';
import { getAdminTranslations } from './i18n-server';

/**
 * zod parsing for the admin Server Actions, with the error messages from
 * messages/admin/ru.json (admin.validation).
 *
 * The schemas (./schemas.ts) carry admin.validation KEYS as their issue messages (errorKey);
 * they are translated here, where issues become field errors, with the issue's numbers as ICU
 * arguments: {min} / {max} of a size check, or the `params` of a custom issue. Issues without
 * a schema-level message get the generic key of their kind (a too long string → tooLong), and
 * anything else zod's own Russian locale (a per-parse error map — the global zod config is
 * left untouched, the public site uses its own messages).
 */
const russianErrors = z.locales.ru().localeError;

export type ParseOutcome<T> =
  | { success: true; data: T }
  | { success: false; fieldErrors: FieldErrors; message: string };

type ValidationTranslator = AdminTranslator<'admin.validation'>;

/** Generic key of an issue that has no schema-level message (undefined = zod's Russian text). */
function genericIssueKey(issue: z.core.$ZodRawIssue): AdminValidationKey | undefined {
  if (issue.code === 'too_big' && issue.origin === 'string') return errorKey('tooLong');
  return undefined;
}

/** ICU arguments of an issue: {min} / {max} of a size check, the params of a custom issue. */
function issueValues(issue: z.core.$ZodIssue): Record<string, string | number> {
  const values: Record<string, string | number> = {};
  if (issue.code === 'too_small') values.min = Number(issue.minimum);
  if (issue.code === 'too_big') values.max = Number(issue.maximum);
  if (issue.code === 'custom' && issue.params) {
    for (const [name, value] of Object.entries(issue.params)) {
      const raw: unknown = value;
      if (typeof raw === 'string' || typeof raw === 'number') values[name] = raw;
    }
  }
  return values;
}

/** The translated message of an issue (zod's own Russian text when it is not an admin key). */
function issueMessage(issue: z.core.$ZodIssue, t: ValidationTranslator): string {
  // t.has is the runtime check that the message is a key; the cast only lets it ask.
  const key = issue.message as AdminValidationKey;
  return t.has(key) ? t(key, issueValues(issue)) : issue.message;
}

export async function parseInput<S extends z.ZodType>(schema: S, input: unknown): Promise<ParseOutcome<z.output<S>>> {
  const result = schema.safeParse(input, { error: issue => genericIssueKey(issue) ?? russianErrors(issue) });
  if (result.success) return { success: true, data: result.data };
  const [t, tErrors] = await Promise.all([
    getAdminTranslations('admin.validation'),
    getAdminTranslations('admin.errors'),
  ]);
  const fieldErrors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.map(segment => String(segment)).join('.') || '_form';
    if (!(key in fieldErrors)) fieldErrors[key] = issueMessage(issue, t);
  }
  return { success: false, fieldErrors, message: tErrors('invalidForm') };
}
