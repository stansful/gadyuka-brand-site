import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "./locales";

/**
 * ru is the default locale and has no prefix ("/"), other locales are prefixed ("/en").
 * Browser-language detection is disabled on purpose: "/" is always Russian, which keeps
 * canonical URLs and hreflang predictable for SEO. Users switch via the language switcher.
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
  localeDetection: false,
});
