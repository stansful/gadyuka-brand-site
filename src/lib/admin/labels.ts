import type { LeadStatus, LeadType } from "@/generated/prisma/enums";
import type { SocialType } from "@/lib/content/schemas";

/** Russian labels for enums shown in the admin (isomorphic). */

export const LEAD_TYPE_LABELS: Readonly<Record<LeadType, string>> = {
  TAILORING: "Индивидуальный пошив",
  PARTNERSHIP: "Сотрудничество",
  CONTACT: "Связаться",
};

export const LEAD_STATUS_LABELS: Readonly<Record<LeadStatus, string>> = {
  NEW: "Новая",
  IN_PROGRESS: "В работе",
  DONE: "Готово",
  SPAM: "Спам",
};

export const LEAD_TYPES: readonly LeadType[] = ["TAILORING", "PARTNERSHIP", "CONTACT"];
export const LEAD_STATUSES: readonly LeadStatus[] = ["NEW", "IN_PROGRESS", "DONE", "SPAM"];

export const SOCIAL_TYPE_LABELS: Readonly<Record<SocialType, string>> = {
  telegram: "Telegram",
  vk: "ВКонтакте",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  youtube: "YouTube",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  website: "Сайт",
  other: "Другое",
};

/** «1 товар», «2 товара», «5 товаров». */
export function pluralRu(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function countRu(count: number, one: string, few: string, many: string): string {
  return `${count} ${pluralRu(count, one, few, many)}`;
}

const DATE_TIME = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow",
});

const DATE_ONLY = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Moscow",
});

/** "16.10.2026, 23:41" (Moscow time) */
export function formatDateTimeRu(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

/** "16 октября 2026" (Moscow time) */
export function formatDateRu(iso: string): string {
  return DATE_ONLY.format(new Date(iso));
}

/** "1,4 МБ" / "820 КБ" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} МБ`;
}

/** "12 900 ₽" */
export function formatRubles(value: number): string {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}
