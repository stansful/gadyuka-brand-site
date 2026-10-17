import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { unstable_rethrow } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import type { Locale } from "./locales";
import { routing } from "./routing";
import type ruMessages from "../../messages/ru.json";

export type Messages = typeof ruMessages;

/**
 * Static loaders: TypeScript forces a messages file for every locale in locales.ts,
 * and every file must have the same shape as ru.json.
 */
const messageLoaders: Record<Locale, () => Promise<Messages>> = {
  ru: () => import("../../messages/ru.json").then((m) => m.default),
  en: () => import("../../messages/en.json").then((m) => m.default),
};

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

export default getRequestConfig(async ({ locale: override }) => {
  const requested = await resolveRequestedLocale(override);
  const locale: Locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: await messageLoaders[locale](),
    timeZone: "Europe/Moscow",
  };
});
