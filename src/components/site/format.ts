import { localeTags, type Locale } from "@/i18n/locales";
import { SOCIAL_TYPES, type SocialType } from "@/lib/content/social";

/** 12 900 ₽ / RUB 12,900 */
export function formatPrice(rubles: number, locale: Locale): string {
  return new Intl.NumberFormat(localeTags[locale], {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(rubles);
}

/** ISO string → "1 октября 2026" / "October 1, 2026" (Moscow time). */
export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTags[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Moscow",
  }).format(new Date(iso));
}

/** ISO string → "01.10.2026" / "10/01/2026" (Moscow time) — the newspaper dateline. */
export function formatShortDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTags[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Moscow",
  }).format(new Date(iso));
}

/** ISO string → "Октябрь 2026" / "October 2026" (standalone month name, capitalized). */
export function formatMonthYear(iso: string, locale: Locale): string {
  const date = new Date(iso);
  const tag = localeTags[locale];
  const month = new Intl.DateTimeFormat(tag, { month: "long", timeZone: "Europe/Moscow" }).format(date);
  const year = new Intl.DateTimeFormat(tag, { year: "numeric", timeZone: "Europe/Moscow" }).format(date).replace(/\D/g, "");
  return `${month.charAt(0).toLocaleUpperCase(tag)}${month.slice(1)} ${year}`;
}

/** "3" → "03" (chapter, product and panel numbers). */
export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Brand names are the same in every language; "other" (and unknown types) use the link's host. */
const SOCIAL_LABELS: Readonly<Partial<Record<SocialType, string>>> = {
  telegram: "Telegram",
  vk: "VK",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  youtube: "YouTube",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  website: "Web",
};

function isSocialType(value: string): value is SocialType {
  return (SOCIAL_TYPES as readonly string[]).includes(value);
}

/** "https://www.behance.net/gadyuka" → "behance.net". */
export function socialLabel(social: { type: string; url: string }): string {
  const known = isSocialType(social.type) ? SOCIAL_LABELS[social.type] : undefined;
  if (known) return known;
  try {
    return new URL(social.url).hostname.replace(/^www\./, "");
  } catch {
    return social.url;
  }
}
