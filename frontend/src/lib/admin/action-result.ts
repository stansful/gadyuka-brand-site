/**
 * Result shape of every admin Server Action (isomorphic: client forms read it).
 *
 * fieldErrors keys are dotted paths of the submitted object, e.g. "slug",
 * "title" (whole LocalizedText) or "title.en" (one translation).
 */
export type FieldErrors = Record<string, string>;

export type ActionSuccess<T> = { ok: true; data: T; message?: string };
export type ActionFailure = { ok: false; error: string; fieldErrors?: FieldErrors };
export type ActionResult<T = null> = ActionSuccess<T> | ActionFailure;

export function actionOk<T>(data: T, message?: string): ActionSuccess<T> {
  return message === undefined ? { ok: true, data } : { ok: true, data, message };
}

export function actionFail(error: string, fieldErrors?: FieldErrors): ActionFailure {
  return fieldErrors && Object.keys(fieldErrors).length > 0 ? { ok: false, error, fieldErrors } : { ok: false, error };
}

/** First error for a field or any of its children ("title" matches "title" and "title.en"). */
export function errorFor(fieldErrors: FieldErrors | undefined, field: string): string | undefined {
  if (!fieldErrors) return undefined;
  const own = fieldErrors[field];
  if (own) return own;
  const prefix = `${field}.`;
  for (const [key, message] of Object.entries(fieldErrors)) {
    if (key.startsWith(prefix)) return message;
  }
  return undefined;
}
