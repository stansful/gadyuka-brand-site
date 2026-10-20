import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { unstable_rethrow } from 'next/navigation';
import { locale as rootLocale } from 'next/root-params';

import type { Locale } from './locales';
import type { SiteMessages } from './messages';

import adminRu from '../../messages/admin/ru.json';
import { routing } from './routing';
import { loadSiteMessages } from './site-messages';

/** The admin UI strings: the "admin" namespace of messages/admin/<locale>.json. */
export type AdminMessages = typeof adminRu;

/**
 * Everything next-intl knows: the site messages (DB-backed, see ./site-messages.ts; the type
 * comes from the static messages/ru.json) + the admin namespace. Feeds the typed keys of
 * getTranslations / useTranslations (./global.d.ts).
 */
export type Messages = SiteMessages & AdminMessages;

/**
 * The admin is Russian-only: a locale without its own messages/admin/<locale>.json gets the
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
 * Every t() of the site, the admin and the Route Handlers goes through this config, so the site
 * messages are read fail-soft (loadSiteMessages): during a database outage they are the bundled
 * defaults instead of an error in the root layouts, the admin login or POST /api/leads.
 * Hence no getTranslations inside "use cache" (the entry would keep the defaults): cached code
 * reads getSiteMessages / getSiteTexts, which fail with the rest of its data.
 */
export default getRequestConfig(async ({ locale: override }) => {
  const requested = await resolveRequestedLocale(override);
  const locale: Locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const messages: Messages = { ...(await loadSiteMessages(locale)), ...adminMessages(locale) };
  return {
    locale,
    messages,
    timeZone: 'Europe/Moscow',
  };
});
