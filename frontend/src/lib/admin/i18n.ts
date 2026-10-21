import type { Locale } from '@/i18n/locales';

import type { createTranslator, MessageKeys, Messages, NamespaceKeys, NestedKeyOf } from 'next-intl';

/**
 * Admin UI strings: shared/messages/admin/ru.json, the "admin" namespace of next-intl (loaded for
 * every locale by src/i18n/request.ts; never seeded into the DB, not editable in the admin).
 * Isomorphic: types and tiny helpers only — the server-side loaders are in ./i18n-server.ts.
 *
 * How the admin reads its copy:
 * - Server Components: getTranslations('admin.<area>') (the admin is outside [locale], so the
 *   locale resolves to the default, ru);
 * - Client Components: useTranslations('admin.<area>') under the admin layout's
 *   NextIntlClientProvider (it ships ONLY the admin namespace to the browser);
 * - Server Actions, Route Handlers, data functions: getAdminTranslations() (./i18n-server.ts);
 * - message keys the backend answers with (validation / errors): translateAdminMessage
 *   (src/lib/api/admin-messages.ts).
 */

/** The admin UI language (Russian only: there is no shared/messages/admin/en.json). */
export const ADMIN_LOCALE = 'ru' satisfies Locale;

/** "admin" and every namespace below it ("admin.collections", "admin.siteTexts.form" …). */
export type AdminNamespace = Extract<NamespaceKeys<Messages, NestedKeyOf<Messages>>, 'admin' | `admin.${string}`>;

/** The translator of an admin namespace — what getTranslations / useTranslations return for it. */
export type AdminTranslator<N extends AdminNamespace> = ReturnType<typeof createTranslator<Messages, N>>;

type AdminTree = Messages['admin'];

/** Any admin message key relative to "admin" ("collections.title"). */
export type AdminMessageKey = MessageKeys<AdminTree, NestedKeyOf<AdminTree>>;
