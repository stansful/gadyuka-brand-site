import "server-only";
import { z } from "zod";
import type { LeadType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

/**
 * Lead notifications via the Telegram Bot API (sendMessage, parse_mode HTML).
 *
 *   sendLeadToTelegram(lead)        — send + record telegramSent / telegramError on the Lead row
 *   resendLeadToTelegram(leadId)    — admin «Отправить повторно»: load the lead, then the same
 *
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_ID (chat id the bot writes to),
 *      TELEGRAM_DRY_RUN=1 → no network: a redacted preview is logged. The lead is recorded
 *      as NOT delivered (telegramSent=false + DRY_RUN_ERROR), so a forgotten dry-run flag in
 *      production shows up in the admin («не отправлено») instead of silently dropping
 *      notifications; in production a loud warning is logged as well.
 * Safety: the token is never logged or returned in errors; under Vitest the network is
 * never used unless a fetch implementation is injected explicitly.
 */

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
export const ADMIN_LEADS_PATH = "/admin/leads";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

/** Stored as Lead.telegramError when TELEGRAM_DRY_RUN=1 suppressed the message. */
export const DRY_RUN_ERROR = "Не отправлено: включён тестовый режим TELEGRAM_DRY_RUN=1 (сообщения в Telegram не уходят)";

/** True when TELEGRAM_DRY_RUN is on (the admin shows a warning about it in production). */
export function isTelegramDryRun(): boolean {
  return getTelegramConfig().dryRun;
}

let warnedAboutProductionDryRun = false;

function warnIfProductionDryRun(): void {
  if (warnedAboutProductionDryRun || process.env.NODE_ENV !== "production") return;
  warnedAboutProductionDryRun = true;
  console.warn(
    "[telegram] ВНИМАНИЕ: TELEGRAM_DRY_RUN=1 в production — заявки сохраняются, но в Telegram НЕ отправляются. " +
      "Задайте TELEGRAM_DRY_RUN=0 в .env и перезапустите приложение.",
  );
}

export function getTelegramConfig(): TelegramConfig {
  return {
    token: process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "",
    chatId: process.env.TELEGRAM_OWNER_ID?.trim() ?? "",
    dryRun: TRUE_VALUES.has((process.env.TELEGRAM_DRY_RUN ?? "").trim().toLowerCase()),
    siteUrl: (process.env.SITE_URL ?? "").trim().replace(/\/+$/, ""),
  };
}

// ─── Formatting ─────────────────────────────────────────────────────────────

/** Escape text for Telegram parse_mode=HTML (only &, <, > need escaping; " for attributes). */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export const LEAD_TYPE_LABELS: Readonly<Record<LeadType, { emoji: string; title: string }>> = {
  TAILORING: { emoji: "🧵", title: "Индивидуальный пошив" },
  PARTNERSHIP: { emoji: "🤝", title: "Сотрудничество" },
  CONTACT: { emoji: "💬", title: "Связаться с нами" },
};

function truncate(value: string, max: number): string {
  const chars = Array.from(value);
  return chars.length <= max ? value : `${chars.slice(0, max - 1).join("")}…`;
}

/** "+79001234567" → "+7******4567"; "ivan@mail.ru" → "i***@mail.ru" (logs only). */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "***";
  return `+${digits.slice(0, 1)}${"*".repeat(Math.max(3, digits.length - 5))}${digits.slice(-4)}`;
}

export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export type FormatLeadOptions = {
  /** Mask e-mail / phone and shorten the message (for logs). */
  redact?: boolean;
  /** Site origin for the admin link; only https origins get a link. */
  siteUrl?: string;
};

/**
 * Russian HTML message for the owner. Every user-provided value is HTML-escaped.
 * The result never exceeds Telegram's 4096-character limit.
 */
export function formatLeadMessage(lead: TelegramLead, options: FormatLeadOptions = {}): string {
  const { emoji, title } = LEAD_TYPE_LABELS[lead.type];
  const redact = options.redact === true;
  const lines: string[] = [`${emoji} <b>Новая заявка: ${escapeHtml(title)}</b>`, ""];

  lines.push(`👤 <b>Имя:</b> ${escapeHtml(lead.name)}`);
  if (lead.phone) lines.push(`📞 <b>Телефон:</b> ${escapeHtml(redact ? maskPhone(lead.phone) : lead.phone)}`);
  if (lead.email) lines.push(`✉️ <b>E-mail:</b> ${escapeHtml(redact ? maskEmail(lead.email) : lead.email)}`);
  lines.push(`🌐 <b>Язык сайта:</b> ${escapeHtml(lead.locale.toUpperCase())}`);

  const head = lines.join("\n");
  const footerLines = [
    "",
    `🕒 ${escapeHtml(dateFormatter.format(lead.createdAt))} (МСК)`,
    `🆔 <code>${escapeHtml(lead.id)}</code>`,
  ];
  const siteUrl = (options.siteUrl ?? "").replace(/\/+$/, "");
  if (siteUrl.startsWith("https://")) {
    footerLines.push(`<a href="${escapeHtml(`${siteUrl}${ADMIN_LEADS_PATH}`)}">Открыть заявки в админке</a>`);
  }
  const footer = footerLines.join("\n");

  const rawMessage = lead.message.trim();
  if (!rawMessage) return `${head}\n${footer}`;

  // Fit the message into the Telegram limit: shrink the user text until the whole thing fits.
  let limit: number = redact ? 200 : TELEGRAM_DEFAULTS.maxUserMessageLength;
  for (;;) {
    const body = `\n\n📝 <b>Сообщение:</b>\n<blockquote>${escapeHtml(truncate(rawMessage, limit))}</blockquote>`;
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

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Remove the token from any text that might end up in logs / the DB. */
function redactToken(text: string, token: string): string {
  return token ? text.split(token).join("***") : text;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") return "превышено время ожидания ответа Telegram";
    const cause = error.cause instanceof Error ? `: ${error.cause.message}` : "";
    return `сетевая ошибка (${error.message}${cause})`;
  }
  return "неизвестная ошибка";
}

function isVitest(): boolean {
  return process.env.VITEST === "true" || process.env.VITEST === "1";
}

type AttemptOutcome = { ok: true } | { ok: false; error: string; retry: boolean; waitMs?: number };

async function attemptSend(
  fetchImpl: typeof fetch,
  config: TelegramConfig,
  text: string,
  timeoutMs: number,
): Promise<AttemptOutcome> {
  let response: Response;
  try {
    response = await fetchImpl(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    return { ok: false, error: describeError(error), retry: true };
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
  const description = payload?.description ?? response.statusText ?? "";
  const error = `Telegram API ${status}${description ? `: ${description}` : ""}`;
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
  if (!config.token || !config.chatId) {
    return { ok: false, error: "Telegram не настроен: задайте TELEGRAM_BOT_TOKEN и TELEGRAM_OWNER_ID в .env" };
  }
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(config.token)) {
    return { ok: false, error: "Telegram не настроен: TELEGRAM_BOT_TOKEN имеет неверный формат" };
  }

  const fetchImpl = injectedFetch ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const retries = options.retries ?? TELEGRAM_DEFAULTS.retries;
  const timeoutMs = options.timeoutMs ?? TELEGRAM_DEFAULTS.timeoutMs;

  let lastError = "неизвестная ошибка";
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const outcome = await attemptSend(fetchImpl, config, text, timeoutMs);
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
function logDryRun(lead: TelegramLead): void {
  warnIfProductionDryRun();
  const preview = formatLeadMessage(lead, { redact: true });
  console.info(`[telegram] DRY RUN (TELEGRAM_DRY_RUN=1) — сообщение не отправлено. Предпросмотр:\n${preview}`);
}

/**
 * Save the delivery result on the Lead row. Errors are logged, never thrown.
 * A dry run is NOT a delivery: telegramSent stays false and the reason is stored.
 */
async function recordResult(leadId: string, result: TelegramResult): Promise<void> {
  const delivered = result.ok && result.dryRun !== true;
  try {
    await db.lead.update({
      where: { id: leadId },
      data: {
        telegramSent: delivered,
        telegramError: delivered
          ? null
          : result.dryRun
            ? DRY_RUN_ERROR
            : (result.error ?? "неизвестная ошибка").slice(0, 2000),
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
  let result: TelegramResult;
  try {
    const config: TelegramConfig = { ...getTelegramConfig(), ...options.config };
    const text = formatLeadMessage(lead, { siteUrl: config.siteUrl });
    result = await sendTelegramMessage(text, { ...options, config });
    if (result.dryRun) logDryRun(lead);
    else if (!result.ok) console.warn(`[telegram] lead ${lead.id} was saved but not delivered: ${result.error ?? ""}`);
  } catch (error: unknown) {
    result = {
      ok: false,
      error: `внутренняя ошибка отправки: ${error instanceof Error ? error.message : String(error)}`,
    };
    console.error(`[telegram] lead ${lead.id}: unexpected error`, error);
  }
  if (options.record !== false) await recordResult(lead.id, result);
  return result;
}

/**
 * Admin «Отправить повторно»: load the lead by id, send it, record the outcome.
 * Returns `{ ok: false, error }` (Russian text) when the lead does not exist or sending fails.
 */
export async function resendLeadToTelegram(leadId: string): Promise<{ ok: boolean; error?: string }> {
  const id = typeof leadId === "string" ? leadId.trim() : "";
  if (!id || id.length > 64) return { ok: false, error: "Некорректный идентификатор заявки" };
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
    return { ok: false, error: "Не удалось загрузить заявку из базы данных" };
  }
  if (!lead) return { ok: false, error: "Заявка не найдена" };
  const result = await sendLeadToTelegram(lead);
  if (result.dryRun) return { ok: false, error: DRY_RUN_ERROR };
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Не удалось отправить в Telegram" };
}
