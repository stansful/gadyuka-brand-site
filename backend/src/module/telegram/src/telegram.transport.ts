import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import { MILLISECONDS_PER_SECOND } from '~core/constants/time.constants';
import { ISleeper } from '~module/common';

import { TelegramApiResponse, TelegramApiResponseParser } from './telegram-api.response';
import { TelegramMessageKey } from './telegram-message-key.enum';
import { TelegramTexts } from './telegram-texts';
import {
  TELEGRAM_API_URL,
  TELEGRAM_DEFAULTS,
  TELEGRAM_FETCH,
  TELEGRAM_OPTIONS,
  TELEGRAM_SLEEPER,
  TELEGRAM_TOKEN_PATTERN,
} from './telegram.constants';
import { TelegramDeliveryStatus, TelegramFetch, TelegramOptions, TelegramSendResult } from './telegram.interfaces';

type AttemptOutcome =
  | { readonly delivered: true }
  | { readonly delivered: false; readonly error: string; readonly retryable: boolean; readonly waitMs: number };

/**
 * Sends an HTML message to the owner chat (Bot API sendMessage): a timeout per attempt and up to
 * `retries` retries with backoff on network errors, 5xx and 429 (Retry-After honoured); other 4xx
 * are final. Dry run → no network. The bot token never appears in a returned error.
 */
@Injectable()
export class TelegramTransport {
  private readonly parser = new TelegramApiResponseParser();

  constructor(
    @Inject(TELEGRAM_OPTIONS) private readonly options: TelegramOptions,
    @Inject(TELEGRAM_FETCH) private readonly fetch: TelegramFetch,
    @Inject(TELEGRAM_SLEEPER) private readonly sleeper: ISleeper,
    private readonly texts: TelegramTexts,
  ) {}

  async send(text: string): Promise<TelegramSendResult> {
    if (this.options.dryRun) {
      return { status: TelegramDeliveryStatus.DRY_RUN };
    }
    const problem = this.findConfigurationProblem();
    if (problem !== undefined) {
      return { status: TelegramDeliveryStatus.FAILED, error: this.texts.text(problem) };
    }
    return this.sendWithRetries(text);
  }

  private findConfigurationProblem(): TelegramMessageKey | undefined {
    if (this.options.token === '' || this.options.chatId === '') {
      return TelegramMessageKey.ERROR_NOT_CONFIGURED;
    }
    return TELEGRAM_TOKEN_PATTERN.test(this.options.token) ? undefined : TelegramMessageKey.ERROR_BAD_TOKEN;
  }

  private async sendWithRetries(text: string): Promise<TelegramSendResult> {
    const retries = this.options.retries ?? TELEGRAM_DEFAULTS.retries;
    for (let attempt = 0; ; attempt += 1) {
      const outcome = await this.attempt(text);
      if (outcome.delivered || !outcome.retryable || attempt >= retries) {
        return this.resultOf(outcome);
      }
      await this.sleeper.sleep(Math.max(this.backoffOf(attempt), outcome.waitMs));
    }
  }

  private resultOf(outcome: AttemptOutcome): TelegramSendResult {
    if (outcome.delivered) {
      return { status: TelegramDeliveryStatus.SENT };
    }
    return { status: TelegramDeliveryStatus.FAILED, error: this.redactToken(outcome.error) };
  }

  private async attempt(text: string): Promise<AttemptOutcome> {
    let response: Response;
    try {
      response = await this.fetch(`${TELEGRAM_API_URL}/bot${this.options.token}/sendMessage`, this.requestOf(text));
    } catch (error: unknown) {
      return { delivered: false, error: this.describeNetworkError(error), retryable: true, waitMs: 0 };
    }
    return this.outcomeOf(response);
  }

  private async outcomeOf(response: Response): Promise<AttemptOutcome> {
    const payload = await this.parser.read(response);
    return response.ok && payload?.ok === true ? { delivered: true } : this.refusalOf(response, payload);
  }

  private requestOf(text: string): RequestInit {
    return {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.messageOf(text)),
      signal: AbortSignal.timeout(this.options.timeoutMs ?? TELEGRAM_DEFAULTS.timeoutMs),
    };
  }

  private messageOf(text: string): Record<string, unknown> {
    return { chat_id: this.options.chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } };
  }

  /**
   * An answer other than ok. Telegram's own description ("Forbidden: bot was blocked by the user")
   * is the technical detail inside the owner's message, like the cause of a network error.
   */
  private refusalOf(response: Response, payload: TelegramApiResponse | undefined): AttemptOutcome {
    const details =
      payload?.description?.trim() || response.statusText.trim() || this.texts.text(TelegramMessageKey.ERROR_UNKNOWN);
    const error = this.texts.text(TelegramMessageKey.ERROR_API, { status: String(response.status), details });
    if (response.status === HttpStatus.TOO_MANY_REQUESTS) {
      const waitMs = this.retryAfterOf(payload);
      return { delivered: false, error, retryable: waitMs <= TELEGRAM_DEFAULTS.maxRetryAfterMs, waitMs };
    }
    return { delivered: false, error, retryable: response.status >= HttpStatus.INTERNAL_SERVER_ERROR, waitMs: 0 };
  }

  /** Retry-After of a 429 in milliseconds (the fallback wait when Telegram does not say). */
  private retryAfterOf(payload: TelegramApiResponse | undefined): number {
    const seconds = payload?.retryAfterSeconds;
    return seconds === undefined ? TELEGRAM_DEFAULTS.fallbackWaitMs : seconds * MILLISECONDS_PER_SECOND;
  }

  private describeNetworkError(error: unknown): string {
    if (!(error instanceof Error)) {
      return this.texts.text(TelegramMessageKey.ERROR_UNKNOWN);
    }
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return this.texts.text(TelegramMessageKey.ERROR_TIMEOUT);
    }
    const cause = error.cause instanceof Error ? `: ${error.cause.message}` : '';
    return this.texts.text(TelegramMessageKey.ERROR_NETWORK, { details: `${error.message}${cause}` });
  }

  private backoffOf(attempt: number): number {
    const backoff: readonly number[] = TELEGRAM_DEFAULTS.backoffMs;
    return backoff[attempt] ?? backoff[backoff.length - 1] ?? TELEGRAM_DEFAULTS.fallbackWaitMs;
  }

  private redactToken(text: string): string {
    return this.options.token === '' ? text : text.split(this.options.token).join('***');
  }
}
