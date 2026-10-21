import type { CalendarDay, SocialType } from '@shared/contracts/content-entities';

/**
 * Display helpers of the admin's content entities (news, gallery, offers, partners, menu, social
 * links) — ISOMORPHIC and dependency-free: the forms (client) and the data functions (server) use
 * them. Data and rules live in the backend (shared/contracts/content-entities.ts).
 */

/** A link suggestion of the menu form (landing anchor, lead form, collection page). */
export type MenuHrefOption = { href: string; label: string };

const MOSCOW_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Moscow',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today in Moscow as "YYYY-MM-DD" (the default date of a new news item, like the site's clock). */
export function todayInMoscow(now: Date = new Date()): CalendarDay {
  return MOSCOW_DAY.format(now);
}

/** "2026-10-31" → "31.10.2026" (dates of the admin lists). */
export function formatCalendarDay(day: CalendarDay): string {
  return day.split('-').reverse().join('.');
}

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
