import 'server-only';
import { createTranslator, type Messages } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { unstable_rethrow } from 'next/navigation';

import { DEFAULT_MESSAGES } from '@/i18n/messages';

import type { Metadata } from 'next';

import adminRu from '../../../messages/admin/ru.json';
import { ADMIN_LOCALE, type AdminMessageKey, type AdminNamespace, type AdminTranslator } from './i18n';

/**
 * Server-side access to the admin UI strings (see ./i18n.ts for the overview).
 *
 * The bundled messages stand in when next-intl's request config cannot be loaded: it also
 * reads the DB-backed site messages, and an admin error path (e.g. «the database is down»)
 * must still be able to explain itself. The admin namespace itself is static either way.
 */
const BUNDLED_MESSAGES: Messages = { ...DEFAULT_MESSAGES[ADMIN_LOCALE], ...adminRu };

/**
 * Translator of an admin namespace for Server Actions, Route Handlers and data functions:
 * getTranslations({ locale: "ru", namespace }) — explicit locale, as root params are not
 * available there — with the bundled messages as the fallback.
 */
export async function getAdminTranslations<N extends AdminNamespace>(namespace: N): Promise<AdminTranslator<N>> {
  try {
    return await getTranslations({ locale: ADMIN_LOCALE, namespace });
  } catch (error: unknown) {
    unstable_rethrow(error);
    console.error(`[admin] next-intl messages unavailable, using the bundled admin copy (${namespace}):`, error);
    return createTranslator({ locale: ADMIN_LOCALE, messages: BUNDLED_MESSAGES, namespace });
  }
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
