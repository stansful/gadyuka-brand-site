import { localeTags, type Locale } from '@/i18n/locales';
import type { SocialLinkView, SocialType, TextKey } from '@/lib/content';

/** 12 900 ₽ / RUB 12,900 */
export function formatPrice(rubles: number, locale: Locale): string {
  return new Intl.NumberFormat(localeTags[locale], {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(rubles);
}

/** ISO string → "1 октября 2026" / "October 1, 2026" (Moscow time). */
export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTags[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Moscow',
  }).format(new Date(iso));
}

/** ISO string → "01.10.2026" / "10/01/2026" (Moscow time) — the newspaper dateline. */
export function formatShortDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTags[locale], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Moscow',
  }).format(new Date(iso));
}

/** ISO string → "Октябрь 2026" / "October 2026" (standalone month name, capitalized). */
export function formatMonthYear(iso: string, locale: Locale): string {
  const date = new Date(iso);
  const tag = localeTags[locale];
  const month = new Intl.DateTimeFormat(tag, { month: 'long', timeZone: 'Europe/Moscow' }).format(date);
  const year = new Intl.DateTimeFormat(tag, { year: 'numeric', timeZone: 'Europe/Moscow' })
    .format(date)
    .replace(/\D/g, '');
  return `${month.charAt(0).toLocaleUpperCase(tag)}${month.slice(1)} ${year}`;
}

/** "3" → "03" (chapter, product and panel numbers). */
export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * "★★★★☆" — a rating on the 1..max star scale of the settings (SiteSettings.reviewRatingMax):
 * filled, then empty. The glyphs are an aria-hidden picture of the number, not copy (screen
 * readers get the message common.rating instead), so they are not translatable.
 */
export function ratingStars(rating: number, max: number): string {
  const scale = Math.max(1, Math.round(max));
  const filled = Math.min(scale, Math.max(0, Math.round(rating)));
  return `${'★'.repeat(filled)}${'☆'.repeat(scale - filled)}`;
}

/**
 * Name of a social link: its own label (SocialLink.label), else the default name of its type —
 * the message social.<TYPE> («Telegram», «Сайт» …); an OTHER link without a label is named
 * after its host ("https://www.behance.net/gadyuka" → "behance.net").
 */
export function socialLabel(
  social: Pick<SocialLinkView, 'type' | 'url' | 'label'>,
  texts: Readonly<Record<Extract<TextKey, `social.${SocialType}`>, string>>,
): string {
  if (social.label) return social.label;
  if (social.type === 'OTHER') {
    try {
      const host = new URL(social.url).hostname.replace(/^www\./, '');
      if (host) return host;
    } catch {
      // not a URL: the default name below
    }
  }
  return texts[`social.${social.type}`];
}
