import { ok, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import type { LeadResendTimeoutMs } from '~shared/contracts/leads';

import { ConfigService } from '~config';
import { MILLISECONDS_PER_SECOND } from '~core/constants/time.constants';
import { Clock, ISleeper } from '~module/common';
import { MessageCatalog, MessageFormatter, MessagesDirectory } from '~module/messages';
import { SiteMessagesService } from '~module/site-messages';
import { InMemorySiteMessageRows } from '~module/site-messages/src/test/in-memory-site-message-rows';
import {
  TELEGRAM_DEFAULTS,
  TelegramDeliveryStatus,
  TelegramFetch,
  TelegramOptionsFactory,
  TelegramTexts,
  TelegramTransport,
} from '~module/telegram';
import { TestEnvironment } from '~test/test-environment';

/** shared/contracts/leads.ts: how long the admin's client waits for the resend answer. */
const CLIENT_WAIT_MS: LeadResendTimeoutMs = 50_000;
/** Room left for the resend's own database work: find the lead, load the texts, store the outcome. */
const DATABASE_ROOM_MS = 5_000;

/** Time that passes only when the transport waits (Telegram answering, the sleeps between attempts). */
class SimulatedTime implements ISleeper {
  private elapsed = 0;

  get elapsedMs(): number {
    return this.elapsed;
  }

  pass(milliseconds: number): void {
    this.elapsed += milliseconds;
  }

  async sleep(milliseconds: number): Promise<void> {
    this.pass(milliseconds);
  }
}

describe('LeadResendUsecase (time budget)', () => {
  const catalog = new MessageCatalog(MessagesDirectory.locate());
  const siteMessages = new SiteMessagesService(new InMemorySiteMessageRows(), new Clock(), catalog);
  const texts = new TelegramTexts(siteMessages, catalog, new MessageFormatter());
  /** The production configuration path: TELEGRAM_* of the environment, the transport's default tuning. */
  const options = TelegramOptionsFactory.fromConfig(
    new ConfigService(
      TestEnvironment.valid({
        TELEGRAM_BOT_TOKEN: '123456789:AAFakeTokenForTests_abcdefghijklmnop',
        TELEGRAM_OWNER_ID: '424242',
        TELEGRAM_DRY_RUN: '0',
      }),
    ),
  );

  it("Telegram's slowest failure still answers before the admin's client gives up", async () => {
    const time = new SimulatedTime();
    // Every attempt answers just before its timeout, with the longest Retry-After the transport waits for.
    const slowest: TelegramFetch = async () => {
      time.pass(TELEGRAM_DEFAULTS.timeoutMs);
      const retryAfter = TELEGRAM_DEFAULTS.maxRetryAfterMs / MILLISECONDS_PER_SECOND;
      const body = JSON.stringify({
        ok: false,
        description: 'Too Many Requests',
        parameters: { retry_after: retryAfter },
      });
      return new Response(body, { status: 429, headers: { 'Content-Type': 'application/json' } });
    };
    const result = await new TelegramTransport(options, slowest, time, texts).send('lead');
    strictEqual(result.status, TelegramDeliveryStatus.FAILED);
    ok(time.elapsedMs + DATABASE_ROOM_MS <= CLIENT_WAIT_MS, `Telegram alone may take ${time.elapsedMs} ms`);
  });
});
