import 'server-only';
import type { FieldErrors } from '@/lib/admin/action-result';
import type { AdminMessageKey } from '@/lib/admin/i18n';
import { getAdminTranslations } from '@/lib/admin/i18n-server';
import type { MessageRef } from '@shared/contracts/errors';

import type { ApiFailure } from './api-result';

/** Prefix of the admin keys the backend answers with ("admin.validation.tooLong"). */
const ADMIN_PREFIX = 'admin.';

/**
 * Backend message keys → the admin's Russian text (shared/messages/admin/ru.json), with their ICU
 * values. A key the admin copy does not have (a newer backend) falls back to `fallbackKey`.
 */
export async function translateAdminMessage(
  ref: MessageRef,
  fallbackKey: AdminMessageKey = 'errors.actionFailed',
): Promise<string> {
  const t = await getAdminTranslations('admin');
  const key = ref.key.startsWith(ADMIN_PREFIX) ? ref.key.slice(ADMIN_PREFIX.length) : ref.key;
  // t.has is the runtime check that the key exists; the cast only lets it ask.
  const known = key as AdminMessageKey;
  return t.has(known) ? t(known, { ...ref.values }) : t(fallbackKey);
}

/** A failed backend call → the form-level error and the per-field errors of an ActionFailure. */
export async function describeAdminFailure(failure: ApiFailure): Promise<{ error: string; fieldErrors?: FieldErrors }> {
  switch (failure.kind) {
    case 'validation': {
      const entries = await Promise.all(
        Object.entries(failure.fields).map(
          async ([path, ref]) => [path || '_form', await translateAdminMessage(ref)] as const,
        ),
      );
      return {
        error: await translateAdminMessage({ key: 'admin.errors.invalidForm' }),
        fieldErrors: Object.fromEntries(entries),
      };
    }
    case 'domain':
      if (failure.status === 401) return { error: await translateAdminMessage({ key: 'admin.errors.sessionExpired' }) };
      return { error: await translateAdminMessage(failure.message) };
    case 'unavailable':
      return { error: await translateAdminMessage({ key: 'admin.errors.actionFailed' }) };
  }
}
