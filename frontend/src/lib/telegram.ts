import 'server-only';
import { createTranslator } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

import type { LeadType } from '@/generated/prisma/enums';
import { defaultLocale, localeTags } from '@/i18n/locales';
import { DEFAULT_MESSAGES, type MessageKey } from '@/i18n/messages';
import { db } from '@/lib/db';

/**
 * Lead notifications via the Telegram Bot API (sendMessage, parse_mode HTML).
 *
 *   sendLeadToTelegram(lead)        — send + record telegramSent / telegramError on the Lead row
 *   resendLeadToTelegram(leadId)    — admin «Отправить повторно»: load the lead, then the same
 *
 * Every word of the message and every status stored in Lead.telegramError is a site message
 * (telegram.*, editable in the admin), always in the default locale — the owner reads Russian
 * whatever the language of the visitor (shown as «Язык сайта»). The HTML markup and the line
 * icons stay here; the messages are HTML-escaped like the visitor's input.
 *
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_ID (chat id the bot writes to),
 *      TELEGRAM_DRY_RUN=1 → no network: a redacted preview is logged. The lead is recorded
 *      as NOT delivered (telegramSent=false + telegram.errors.dryRun), so a forgotten dry-run
 *      flag in production shows up in the admin («не отправлено») instead of silently dropping
 *      notifications; in production a loud warning is logged as well.
 * Safety: the token is never logged or returned in errors; under Vitest the network is
 * never used unless a fetch implementation is injected explicitly.
 */

/** A key of the telegram.* messages, without the namespace ("newLead", "errors.dryRun"). */
export type TelegramMessageKey = MessageKey extends infer K ? (K extends `telegram.${infer R}` ? R : never) : never;

/** The owner-facing copy: telegram.* in the default locale, ICU arguments filled in. */
export type TelegramText = (key: TelegramMessageKey, values?: Readonly<Record<string, string | number>>) => string;

/** The bundled defaults (messages/<default locale>.json) — when the DB-backed messages cannot be read. */
function defaultTelegramText(): TelegramText {
  const t = createTranslator({
    locale: defaultLocale,
    messages: DEFAULT_MESSAGES[defaultLocale],
    namespace: 'telegram',
  });
  return (key, values) => t(key, values ? { ...values } : undefined);
}

/**
 * The telegram.* messages (DB rows over the JSON defaults, cached with the site content). A
 * notification must never be lost to a failing message read: the bundled defaults stand in.
 */
export async function loadTelegramText(): Promise<TelegramText> {
  try {
    const t = await getTranslations({ locale: defaultLocale, namespace: 'telegram' });
    return (key, values) => t(key, values ? { ...values } : undefined);
  } catch (error: unknown) {
    console.error('[telegram] could not read the telegram.* messages, using the defaults:', error);
    return defaultTelegramText();
  }
}

export type TelegramResult = { ok: boolean; error?: string; dryRun?: boolean };

/** The Lead fields the message needs (a Prisma Lead row satisfies it). */
export type TelegramLead = {
  id: string;
  type: LeadType;
  name: string;
  email: string | null;
  phone: string | null;
  message: string;
  locale: string;
  createdAt: Date;
};

export type TelegramSendOptions = {
  /** The telegram.* messages (default: loadTelegramText()). */
  t?: TelegramText;
  /** Injected fetch (tests). Default: global fetch. */
  fetch?: typeof fetch;
  /** Injected sleep for backoff (tests). */
  sleep?: (ms: number) => Promise<void>;
  /** Per-attempt timeout, ms. */
  timeoutMs?: number;
  /** Retries after the first attempt. */
  retries?: number;
  /** Override env config (tests). */
  config?: Partial<TelegramConfig>;
};

export type TelegramConfig = {
  token: string;
  chatId: string;
  dryRun: boolean;
  /** Public site origin (for the «открыть в админке» link); "" = no link. */
  siteUrl: string;
};

export const TELEGRAM_DEFAULTS = {
  timeoutMs: 8_000,
  retries: 2,
  backoffMs: [700, 2_000],
  /** Longest Retry-After (429) we are willing to wait for. */
  maxRetryAfterMs: 10_000,
  /** Telegram limit for a text message. */
  maxMessageLength: 4096,
  /** User message is cut to this many characters before escaping. */
  maxUserMessageLength: 2500,
} as const;

/** Path of the leads list in the admin (used in the message footer link). */
export const ADMIN_LEADS_PATH = '/admin/leads';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

/** True when TELEGRAM_DRY_RUN is on (the admin shows a warning about it in production). */
export function isTelegramDryRun(): boolean {
  return getTelegramConfig().dryRun;
}

let warnedAboutProductionDryRun = false;

function warnIfProductionDryRun(): void {
  if (warnedAboutProductionDryRun || process.env.NODE_ENV !== 'production') return;
  warnedAboutProductionDryRun = true;
  console.warn(
    '[telegram] WARNING: TELEGRAM_DRY_RUN=1 in production — leads are saved but NOT sent to Telegram. ' +
      'Set TELEGRAM_DRY_RUN=0 in .env and restart the app.',
  );
}

export function getTelegramConfig(): TelegramConfig {
  return {
    token: process.env.TELEGRAM_BOT_TOKEN?.trim() ?? '',
    chatId: process.env.TELEGRAM_OWNER_ID?.trim() ?? '',
    dryRun: TRUE_VALUES.has((process.env.TELEGRAM_DRY_RUN ?? '').trim().toLowerCase()),
    siteUrl: (process.env.SITE_URL ?? '').trim().replace(/\/+$/, ''),
  };
}

// ─── Formatting ─────────────────────────────────────────────────────────────

/** Escape text for Telegram parse_mode=HTML (only &, <, > need escaping; " for attributes). */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Icon of each lead type (the title is the message telegram.leadTypes.<TYPE>). */
export const LEAD_TYPE_EMOJI: Readonly<Record<LeadType, string>> = {
  TAILORING: '🧵',
  PARTNERSHIP: '🤝',
  CONTACT: '💬',
};

function truncate(value: string, max: number): string {
  const chars = Array.from(value);
  return chars.length <= max ? value : `${chars.slice(0, max - 1).join('')}…`;
}

/** "+79001234567" → "+7******4567"; "ivan@mail.ru" → "i***@mail.ru" (logs only). */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '***';
  return `+${digits.slice(0, 1)}${'*'.repeat(Math.max(3, digits.length - 5))}${digits.slice(-4)}`;
}

export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

/** The owner's clock: Moscow time, written the default locale's way. */
const dateFormatter = new Intl.DateTimeFormat(localeTags[defaultLocale], {
  timeZone: 'Europe/Moscow',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export type FormatLeadOptions = {
  /** Mask e-mail / phone and shorten the message (for logs). */
  redact?: boolean;
  /** Site origin for the admin link; only https origins get a link. */
  siteUrl?: string;
};

/**
 * The owner's HTML message (telegram.* messages, see the module comment). Every message and
 * every user-provided value is HTML-escaped. The result never exceeds Telegram's
 * 4096-character limit.
 */
export function formatLeadMessage(lead: TelegramLead, t: TelegramText, options: FormatLeadOptions = {}): string {
  const emoji = LEAD_TYPE_EMOJI[lead.type];
  const title = t('newLead', { type: t(`leadTypes.${lead.type}`) });
  const redact = options.redact === true;
  const label = (key: TelegramMessageKey): string => `<b>${escapeHtml(t(key))}</b>`;
  const lines: string[] = [`${emoji} <b>${escapeHtml(title)}</b>`, ''];

  lines.push(`👤 ${label('name')} ${escapeHtml(lead.name)}`);
  if (lead.phone) lines.push(`📞 ${label('phone')} ${escapeHtml(redact ? maskPhone(lead.phone) : lead.phone)}`);
  if (lead.email) lines.push(`✉️ ${label('email')} ${escapeHtml(redact ? maskEmail(lead.email) : lead.email)}`);
  lines.push(`🌐 ${label('locale')} ${escapeHtml(lead.locale.toUpperCase())}`);

  const head = lines.join('\n');
  const footerLines = [
    '',
    `🕒 ${escapeHtml(t('time', { time: dateFormatter.format(lead.createdAt) }))}`,
    `🆔 <code>${escapeHtml(lead.id)}</code>`,
  ];
  const siteUrl = (options.siteUrl ?? '').replace(/\/+$/, '');
  if (siteUrl.startsWith('https://')) {
    footerLines.push(`<a href="${escapeHtml(`${siteUrl}${ADMIN_LEADS_PATH}`)}">${escapeHtml(t('openAdmin'))}</a>`);
  }
  const footer = footerLines.join('\n');

  const rawMessage = lead.message.trim();
  if (!rawMessage) return `${head}\n${footer}`;

  // Fit the message into the Telegram limit: shrink the user text until the whole thing fits.
  let limit: number = redact ? 200 : TELEGRAM_DEFAULTS.maxUserMessageLength;
  for (;;) {
    const body = `\n\n📝 ${label('message')}\n<blockquote>${escapeHtml(truncate(rawMessage, limit))}</blockquote>`;
    const text = `${head}${body}\n${footer}`;
    if (text.length <= TELEGRAM_DEFAULTS.maxMessageLength || limit <= 100) return text;
    limit = Math.floor(limit * 0.8);
  }
}

// ─── Sending ────────────────────────────────────────────────────────────────

const telegramResponseSchema = z.object({
  ok: z.boolean(),
  description: z.string().optional(),
  error_code: z.number().optional(),
  parameters: z.object({ retry_after: z.number().optional() }).optional(),
});

const defaultSleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** Remove the token from any text that might end up in logs / the DB. */
function redactToken(text: string, token: string): string {
  return token ? text.split(token).join('***') : text;
}

function describeError(error: unknown, t: TelegramText): string {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') return t('errors.timeout');
    const cause = error.cause instanceof Error ? `: ${error.cause.message}` : '';
    return t('errors.network', { details: `${error.message}${cause}` });
  }
  return t('errors.unknown');
}

function isVitest(): boolean {
  return process.env.VITEST === 'true' || process.env.VITEST === '1';
}

type AttemptOutcome = { ok: true } | { ok: false; error: string; retry: boolean; waitMs?: number };

async function attemptSend(
  fetchImpl: typeof fetch,
  config: TelegramConfig,
  text: string,
  timeoutMs: number,
  t: TelegramText,
): Promise<AttemptOutcome> {
  let response: Response;
  try {
    response = await fetchImpl(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    return { ok: false, error: describeError(error, t), retry: true };
  }

  let payload: z.infer<typeof telegramResponseSchema> | null = null;
  try {
    const parsed = telegramResponseSchema.safeParse(await response.json());
    payload = parsed.success ? parsed.data : null;
  } catch {
    payload = null;
  }

  if (response.ok && payload?.ok === true) return { ok: true };

  const status = response.status;
  // Telegram's own description ("Forbidden: bot was blocked by the user") is untranslatable:
  // it is the technical detail inside the owner's message, like the cause of errors.network.
  const details = payload?.description?.trim() || response.statusText.trim() || t('errors.unknown');
  const error = t('errors.api', { status: String(status), details });
  if (status === 429) {
    const retryAfterMs = (payload?.parameters?.retry_after ?? 1) * 1000;
    return { ok: false, error, retry: retryAfterMs <= TELEGRAM_DEFAULTS.maxRetryAfterMs, waitMs: retryAfterMs };
  }
  return { ok: false, error, retry: status >= 500 };
}

/**
 * Send an HTML message to the owner chat: per-attempt timeout, up to `retries` retries
 * with backoff on network errors / 5xx / 429 (Retry-After honored). 4xx are not retried.
 */
export async function sendTelegramMessage(text: string, options: TelegramSendOptions = {}): Promise<TelegramResult> {
  const config: TelegramConfig = { ...getTelegramConfig(), ...options.config };
  const injectedFetch = options.fetch;

  if (config.dryRun || (isVitest() && !injectedFetch)) {
    return { ok: true, dryRun: true };
  }
  const t = options.t ?? (await loadTelegramText());
  if (!config.token || !config.chatId) {
    return { ok: false, error: t('errors.notConfigured') };
  }
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(config.token)) {
    return { ok: false, error: t('errors.badToken') };
  }

  const fetchImpl = injectedFetch ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const retries = options.retries ?? TELEGRAM_DEFAULTS.retries;
  const timeoutMs = options.timeoutMs ?? TELEGRAM_DEFAULTS.timeoutMs;

  let lastError = t('errors.unknown');
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const outcome = await attemptSend(fetchImpl, config, text, timeoutMs, t);
    if (outcome.ok) return { ok: true };
    lastError = redactToken(outcome.error, config.token);
    if (!outcome.retry || attempt === retries) break;
    const backoff =
      TELEGRAM_DEFAULTS.backoffMs[attempt] ??
      TELEGRAM_DEFAULTS.backoffMs[TELEGRAM_DEFAULTS.backoffMs.length - 1] ??
      1000;
    await sleep(Math.max(backoff, outcome.waitMs ?? 0));
  }
  return { ok: false, error: lastError };
}

/** Log a redacted preview of a lead message (dry-run). Never logs the token or full contacts. */
function logDryRun(lead: TelegramLead, t: TelegramText): void {
  warnIfProductionDryRun();
  const preview = formatLeadMessage(lead, t, { redact: true });
  console.info(`[telegram] DRY RUN (TELEGRAM_DRY_RUN=1) — message not sent. Preview:\n${preview}`);
}

/**
 * Save the delivery result on the Lead row. Errors are logged, never thrown.
 * A dry run is NOT a delivery: telegramSent stays false and the reason is stored.
 */
async function recordResult(leadId: string, result: TelegramResult, t: TelegramText): Promise<void> {
  const delivered = result.ok && result.dryRun !== true;
  try {
    await db.lead.update({
      where: { id: leadId },
      data: {
        telegramSent: delivered,
        telegramError: delivered
          ? null
          : result.dryRun
            ? t('errors.dryRun')
            : (result.error ?? t('errors.unknown')).slice(0, 2000),
      },
    });
  } catch (error: unknown) {
    console.error(`[telegram] could not record the delivery result for lead ${leadId}:`, error);
  }
}

export type SendLeadOptions = TelegramSendOptions & {
  /** Store telegramSent / telegramError on the Lead row (default true). */
  record?: boolean;
};

/**
 * Send a new lead to the owner and record the outcome on the Lead row.
 * Never throws: a Telegram failure leaves the lead with telegramSent=false + telegramError,
 * so it can be re-sent from the admin.
 */
export async function sendLeadToTelegram(lead: TelegramLead, options: SendLeadOptions = {}): Promise<TelegramResult> {
  const t = options.t ?? (await loadTelegramText());
  let result: TelegramResult;
  try {
    const config: TelegramConfig = { ...getTelegramConfig(), ...options.config };
    const text = formatLeadMessage(lead, t, { siteUrl: config.siteUrl });
    result = await sendTelegramMessage(text, { ...options, config, t });
    if (result.dryRun) logDryRun(lead, t);
    else if (!result.ok) console.warn(`[telegram] lead ${lead.id} was saved but not delivered: ${result.error ?? ''}`);
  } catch (error: unknown) {
    result = {
      ok: false,
      error: t('errors.internal', { details: error instanceof Error ? error.message : String(error) }),
    };
    console.error(`[telegram] lead ${lead.id}: unexpected error`, error);
  }
  if (options.record !== false) await recordResult(lead.id, result, t);
  return result;
}

/**
 * Admin «Отправить повторно»: load the lead by id, send it, record the outcome.
 * Returns `{ ok: false, error }` (a telegram.errors.* message) when the lead does not exist or
 * sending fails.
 */
export async function resendLeadToTelegram(
  leadId: string,
  options: Pick<SendLeadOptions, 't'> = {},
): Promise<{ ok: boolean; error?: string }> {
  const t = options.t ?? (await loadTelegramText());
  const id = typeof leadId === 'string' ? leadId.trim() : '';
  if (!id || id.length > 64) return { ok: false, error: t('errors.invalidId') };
  let lead: TelegramLead | null;
  try {
    lead = await db.lead.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        name: true,
        email: true,
        phone: true,
        message: true,
        locale: true,
        createdAt: true,
      },
    });
  } catch (error: unknown) {
    console.error(`[telegram] could not load lead ${id}:`, error);
    return { ok: false, error: t('errors.loadFailed') };
  }
  if (!lead) return { ok: false, error: t('errors.notFound') };
  const result = await sendLeadToTelegram(lead, { t });
  if (result.dryRun) return { ok: false, error: t('errors.dryRun') };
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? t('errors.sendFailed') };
}

/**
 * Lead.telegramError of a lead saved while the site-wide notification ceiling was exceeded
 * (src/app/api/leads/submit.ts): telegram.errors.notifyCeiling.
 */
export async function notifyCeilingError(ceiling: { max: number; windowMs: number }): Promise<string> {
  const t = await loadTelegramText();
  return t('errors.notifyCeiling', { max: ceiling.max, minutes: Math.round(ceiling.windowMs / 60_000) });
}
