import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { unstable_rethrow } from 'next/navigation';
import { locale as rootLocale } from 'next/root-params';

import adminRu from '@shared/messages/admin/ru.json';

import type { Locale } from './locales';

import { DEFAULT_MESSAGES, type SiteMessages } from './messages';
import { routing } from './routing';
import { loadSiteMessages } from './site-messages';

/** The admin UI strings: the "admin" namespace of shared/messages/admin/<locale>.json. */
export type AdminMessages = typeof adminRu;

/**
 * Everything next-intl knows: the site messages (from the backend, see ./site-messages.ts; the
 * type comes from the static shared/messages/ru.json) + the admin namespace. Feeds the typed keys of
 * getTranslations / useTranslations (./global.d.ts).
 */
export type Messages = SiteMessages & AdminMessages;

/**
 * The admin is Russian-only: a locale without its own shared/messages/admin/<locale>.json gets the
 * Russian file. Static imports — the admin strings are not stored in the DB and not editable.
 */
const ADMIN_MESSAGES: Readonly<Partial<Record<Locale, AdminMessages>>> = { ru: adminRu };

function adminMessages(locale: Locale): AdminMessages {
  return ADMIN_MESSAGES[locale] ?? adminRu;
}

/**
 * Locale resolution order:
 * 1. explicit override, e.g. getTranslations({ locale: "en" }) — use this in
 *    Route Handlers / Server Actions, where root params are not available;
 * 2. the `[locale]` root param (next/root-params, works inside "use cache" too);
 * 3. the default locale.
 */
async function resolveRequestedLocale(override: string | undefined): Promise<string | undefined> {
  if (override) return override;
  try {
    return await rootLocale();
  } catch (error: unknown) {
    // Let Next.js control-flow errors (prerender bail-outs etc.) through.
    unstable_rethrow(error);
    // Not inside the [locale] tree (Route Handler, Server Action, /admin): use the default.
    return undefined;
  }
}

/**
 * Every t() of the site, the admin and the Route Handlers goes through this config.
 * - In the [locale] tree, or with an explicit locale (getTranslations({ locale, namespace }) in Route
 *   Handlers / Server Actions — POST /api/leads, the admin's getAdminTranslations), the site messages
 *   are read from the backend fail-soft (loadSiteMessages: request time only, the bundled defaults
 *   during an outage instead of an error in the root layouts, the admin login or POST /api/leads).
 * - Without either (the admin layout and the admin's getTranslations('admin.…') — they only use the
 *   admin namespace) the site part is the bundled shared/messages defaults: no backend call, and the
 *   admin shell does not block on the site's data. Code outside the [locale] tree that needs the
 *   site's EDITED texts passes the locale explicitly.
 * Hence no getTranslations inside "use cache" (the entry would keep the defaults): cached code
 * reads getSiteMessages / getSiteTexts, which fail with the rest of its data.
 */
export default getRequestConfig(async ({ locale: override }) => {
  const requested = await resolveRequestedLocale(override);
  const locale: Locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const site = requested === undefined ? DEFAULT_MESSAGES[locale] : await loadSiteMessages(locale);
  const messages: Messages = { ...site, ...adminMessages(locale) };
  return {
    locale,
    messages,
    timeZone: 'Europe/Moscow',
  };
});
