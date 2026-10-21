export const TELEGRAM_OPTIONS = Symbol('telegram-options');
export const TELEGRAM_FETCH = Symbol('telegram-fetch');
export const TELEGRAM_SLEEPER = Symbol('telegram-sleeper');

export const TELEGRAM_API_URL = 'https://api.telegram.org';

/** Transport defaults (overridable per TelegramOptions, e.g. in tests). */
export const TELEGRAM_DEFAULTS = {
  timeoutMs: 8_000,
  retries: 2,
  backoffMs: [700, 2_000],
  /** Longest Retry-After (429) we are willing to wait for. */
  maxRetryAfterMs: 10_000,
  /** Wait before a retry when neither the backoff steps nor Retry-After say how long. */
  fallbackWaitMs: 1_000,
  /** Telegram limit for a text message. */
  maxMessageLength: 4096,
  /** The visitor's message is cut to this many characters before escaping… */
  maxUserMessageLength: 2500,
  /** …and shrunk by this factor until the whole text fits, down to this many characters. */
  shrinkFactor: 0.8,
  minUserMessageLength: 100,
  /** Longest Lead.telegramError stored. */
  maxErrorLength: 2000,
} as const;

/** Path of the leads list in the admin (the «открыть в админке» link of the message). */
export const ADMIN_LEADS_PATH = '/admin/leads';

/** A bot token: "<bot id>:<secret>". */
export const TELEGRAM_TOKEN_PATTERN = /^\d+:[A-Za-z0-9_-]{20,}$/;

/** The owner's clock. */
export const TELEGRAM_TIME_ZONE = 'Europe/Moscow';
