import 'server-only';
import { createTranslator, type Messages } from 'next-intl';

import { DEFAULT_MESSAGES } from '@/i18n/messages';
import adminRu from '@shared/messages/admin/ru.json';

import type { Metadata } from 'next';

import { ADMIN_LOCALE, type AdminMessageKey, type AdminNamespace, type AdminTranslator } from './i18n';

/**
 * Server-side access to the admin UI strings (see ./i18n.ts for the overview).
 *
 * The admin namespace is static (shared/messages/admin/ru.json, never edited in the admin), so the
 * translator is built from the bundled messages directly — not through next-intl's request config,
 * which would also read the site messages from the backend: an admin data function, action or
 * generateMetadata needs none of them and must not wait for them.
 */
const BUNDLED_MESSAGES: Messages = { ...DEFAULT_MESSAGES[ADMIN_LOCALE], ...adminRu };

/** The admin's clock (dates in the admin are Moscow time, like the request config's timeZone). */
const ADMIN_TIME_ZONE = 'Europe/Moscow';

/** Translator of an admin namespace for Server Actions, Route Handlers and data functions. */
export async function getAdminTranslations<N extends AdminNamespace>(namespace: N): Promise<AdminTranslator<N>> {
  return createTranslator({ locale: ADMIN_LOCALE, messages: BUNDLED_MESSAGES, namespace, timeZone: ADMIN_TIME_ZONE });
}

/**
 * `generateMetadata` of an admin page: the tab title is the admin message `key` (the root
 * layout's template adds «— админка ГАДЮКА»).
 *   export const generateMetadata = (): Promise<Metadata> => adminPageMetadata('collections.title');
 */
export async function adminPageMetadata(key: AdminMessageKey): Promise<Metadata> {
  const t = await getAdminTranslations('admin');
  return { title: t(key) };
}
