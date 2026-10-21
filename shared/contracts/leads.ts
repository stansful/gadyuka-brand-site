/**
 * Leads (owner: slice S2).
 *
 * Public (the site's /api/leads route handler forwards the visitor's form):
 * - POST /public/leads  LeadSubmitPayload (+ x-client-ip, x-client-user-agent) → 201 LeadSubmitResponse
 *   - 400 validation: `fields` keyed by LeadErrorField, keys `forms.errors.*` of the site messages
 *     (`tooShort` { min }, `tooLong` { max }); a filled honeypot (`hp`) → 201 with a decoy id, nothing stored;
 *   - 429 throttled (key `forms.errors.rateLimited`, `details.retryAfterSeconds`): 5 leads / 10 min per
 *     visitor network (IPv4 address / IPv6 /64);
 *   - 5xx: the lead could not be stored (database down …).
 *   The Telegram notification is sent after the answer; past 60 leads / 10 min site-wide it is skipped
 *   (the lead is stored «not sent», the owner can re-send it).
 *
 * Admin (ADMIN role):
 * - GET   /admin/leads?type&status&page      → LeadListResponse (25 per page, newest first; `page` is
 *   clamped to 1…pageCount)
 * - GET   /admin/leads/:id                   → LeadDetailResponse (404 `admin.leads.notFound`)
 * - PATCH /admin/leads/:id/status            LeadStatusRequest → LeadStatusResponse (404 `admin.errors.notFound`)
 * - POST  /admin/leads/:id/resend            → 200 LeadResendResponse (404 `admin.leads.notFound`); answers
 *   after Telegram did, within LeadResendTimeoutMs
 * - GET   /admin/leads/telegram/status       → LeadTelegramStatusResponse
 * Invalid ids / filters / statuses: 400 validation (`admin.validation.idInvalid`, `admin.validation.invalid`).
 */

import type { IsoDateTime, Locale, OffsetPage, Uuid } from './common';

export type LeadType = 'TAILORING' | 'PARTNERSHIP' | 'CONTACT';

export type LeadStatus = 'NEW' | 'IN_PROGRESS' | 'DONE' | 'SPAM';

// ─── POST /public/leads ─────────────────────────────────────────────────────

/** The form as a well-behaved client fills it in (the site's LeadForm). */
export interface LeadSubmitRequest {
  readonly type: LeadType;
  readonly name: string;
  /** Optional for TAILORING / PARTNERSHIP (then e-mail or phone), required for CONTACT */
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly message?: string | null;
  /** Language of the page; anything else is stored as the default locale */
  readonly locale?: Locale;
  /** The personal data consent checkbox: must be `true` */
  readonly consent: boolean;
  /** Honeypot — always "" (or absent); anything else = a bot */
  readonly hp?: string;
  /** Page the form was sent from (Referer of the visitor's request; stored cut to 500 characters) */
  readonly referer?: string;
}

/**
 * What the site's server forwards: the visitor's values exactly as received (any JSON value — the
 * backend checks their types too), only the fields of LeadSubmitRequest.
 */
export type LeadSubmitPayload = { readonly [Field in keyof LeadSubmitRequest]?: unknown };

/** 201: the stored lead's id (a decoy id of the same format for a honeypot hit). */
export interface LeadSubmitResponse {
  readonly id: Uuid;
}

/** Keys of `fields` in the 400 validation answer. `contact` = the «e-mail or phone» group error. */
export type LeadErrorField = 'type' | 'name' | 'email' | 'phone' | 'message' | 'consent' | 'contact';

/** `details` of the 429 answer. */
export interface LeadRateLimitDetails {
  /** Seconds until the visitor's network may send a lead again (also the Retry-After of the site) */
  readonly retryAfterSeconds: number;
}

// ─── /admin/leads ───────────────────────────────────────────────────────────

/** GET /admin/leads query (unknown values are refused: the admin's filter offers only these). */
export interface LeadListQuery {
  readonly type?: LeadType;
  readonly status?: LeadStatus;
  /** 1-based; past the last page → the last page */
  readonly page?: number;
}

/** A row of the leads list (and of the dashboard's latest leads). */
export interface LeadListItem {
  readonly id: Uuid;
  readonly type: LeadType;
  readonly status: LeadStatus;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  /** The message on one line, cut to 140 characters (+ «…») */
  readonly preview: string;
  readonly locale: string;
  readonly telegramSent: boolean;
  readonly createdAt: IsoDateTime;
}

export interface LeadListResponse extends OffsetPage<LeadListItem> {
  /** At least 1 (an empty list has one empty page) */
  readonly pageCount: number;
}

/** One entry of Lead.meta as the admin shows it (consentAt, userAgent, referer, source …). */
export interface LeadMetaEntry {
  readonly key: string;
  /** Strings as is, anything else as JSON */
  readonly value: string;
}

export interface LeadDetailResponse extends LeadListItem {
  readonly message: string;
  /** Why the Telegram notification was not delivered (owner-facing text of telegram.errors.*) */
  readonly telegramError: string | null;
  /** At most 50 entries */
  readonly meta: readonly LeadMetaEntry[];
  readonly updatedAt: IsoDateTime;
}

/** PATCH /admin/leads/:id/status */
export interface LeadStatusRequest {
  readonly status: LeadStatus;
}

export interface LeadStatusResponse {
  readonly id: Uuid;
  readonly status: LeadStatus;
}

/**
 * POST /admin/leads/:id/resend: the outcome of this attempt, as stored on the lead (`telegramError`:
 * the owner-facing reason when not delivered — a dry run counts as not delivered).
 */
export interface LeadResendResponse {
  readonly id: Uuid;
  readonly telegramSent: boolean;
  readonly telegramError: string | null;
}

/**
 * How long the client waits for POST /admin/leads/:id/resend, in milliseconds (instead of http.ts
 * ApiRequestTimeoutMs): the backend answers once Telegram has — every attempt's timeout, the retries and
 * their waits (Retry-After included) — and that, with the reads and the write of the lead, fits in it.
 * Waiting less shows the admin a generic failure while the send goes on (and a second click sends twice).
 */
export type LeadResendTimeoutMs = 50_000;

/** GET /admin/leads/telegram/status: the admin warns while notifications are switched off. */
export interface LeadTelegramStatusResponse {
  /** TELEGRAM_DRY_RUN: leads are stored but nothing is sent to Telegram */
  readonly dryRun: boolean;
}
