import type { LeadStatus, LeadType } from '@/generated/prisma/enums';
import type { SocialType } from '@/lib/content/social';

/**
 * Enum lists and ru-only formatters of the admin (isomorphic). The enum NAMES are admin copy:
 * admin.leads.types / admin.leads.statuses / admin.socials.types in messages/admin/ru.json;
 * counts with plural forms are ICU plurals there too.
 */

export const LEAD_TYPES: readonly LeadType[] = ['TAILORING', 'PARTNERSHIP', 'CONTACT'];
export const LEAD_STATUSES: readonly LeadStatus[] = ['NEW', 'IN_PROGRESS', 'DONE', 'SPAM'];

/** Example link per social type (placeholder of the URL field). */
export const SOCIAL_URL_PLACEHOLDERS: Readonly<Record<SocialType, string>> = {
  TELEGRAM: 'https://t.me/…',
  VK: 'https://vk.com/…',
  INSTAGRAM: 'https://instagram.com/…',
  WHATSAPP: 'https://wa.me/79000000000',
  YOUTUBE: 'https://youtube.com/@…',
  TIKTOK: 'https://tiktok.com/@…',
  PINTEREST: 'https://pinterest.com/…',
  WEBSITE: 'https://…',
  OTHER: 'https://…',
};

/** "★★★★☆" — `rating` filled stars of `max` (the rating is clamped to the scale). */
export function formatStars(rating: number, max: number): string {
  const scale = Math.max(1, Math.round(max));
  const filled = Math.min(scale, Math.max(0, Math.round(rating)));
  return `${'★'.repeat(filled)}${'☆'.repeat(scale - filled)}`;
}

const DATE_TIME = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Moscow',
});

const DATE_ONLY = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Moscow',
});

/** "16.10.2026, 23:41" (Moscow time) */
export function formatDateTimeRu(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

/** "16 октября 2026" (Moscow time) */
export function formatDateRu(iso: string): string {
  return DATE_ONLY.format(new Date(iso));
}

/**
 * A file size in the unit the admin shows it in — the ICU arguments of admin.media.fileSize
 * («820 КБ», «1,4 МБ»): bytes below 1 KB, whole kilobytes below 1 MB, megabytes to 0.1.
 */
export function fileSizeParts(bytes: number): { unit: 'b' | 'kb' | 'mb'; value: number } {
  if (bytes < 1024) return { unit: 'b', value: bytes };
  if (bytes < 1024 * 1024) return { unit: 'kb', value: Math.round(bytes / 1024) };
  return { unit: 'mb', value: Math.round((bytes / (1024 * 1024)) * 10) / 10 };
}

/** "12 900 ₽" */
export function formatRubles(value: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value);
}
