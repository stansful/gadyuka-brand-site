/**
 * Limits of the lead form (the site's form uses the same numbers: frontend src/lib/lead-form-config.ts
 * LEAD_LIMITS). Lengths are UTF-16 code units after trimming, like the form's `maxLength`.
 */
export const LEAD_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  emailMax: 254,
  phoneMax: 32,
  messageMax: 2000,
} as const;

/** Name of the honeypot field: real visitors never see it, bots fill it in. */
export const LEAD_HONEYPOT_FIELD = 'hp';

/** Longest request metadata stored with a lead (Lead.meta). */
export const LEAD_META_LIMITS = {
  userAgent: 300,
  referer: 500,
} as const;

/** Lead.meta.source of the site's forms. */
export const LEAD_SOURCE_SITE = 'site';

const TEN_MINUTES_MS = 10 * 60 * 1000;

/** Per visitor network (IPv4 address / IPv6 /64): the 6th lead within 10 minutes is refused. */
export const LEAD_RATE_LIMIT = { max: 5, windowMs: TEN_MINUTES_MS } as const;

/** Site-wide: past 60 leads within 10 minutes leads are still stored, but Telegram is not notified. */
export const LEAD_NOTIFY_CEILING = { max: 60, windowMs: TEN_MINUTES_MS } as const;

/** Leads per page of the admin list. */
export const LEADS_PAGE_SIZE = 25;
