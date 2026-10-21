import { deepStrictEqual, strictEqual } from 'node:assert';
import { describe, it, mock } from 'node:test';

import { LeadType } from '~core/leads/lead-type';
import { Locale } from '~core/locales/locale.enum';
import { Clock, ISleeper } from '~module/common';
import { MessageCatalog, MessageFormatter, MessagesDirectory } from '~module/messages';
import { SiteMessagesService } from '~module/site-messages';
import { InMemorySiteMessageRows } from '~module/site-messages/src/test/in-memory-site-message-rows';
import {
  LeadMessageFormatter,
  TelegramFetch,
  TelegramLead,
  TelegramLeadNotifier,
  TelegramOptions,
  TelegramTexts,
  TelegramTransport,
} from '~module/telegram';

import { LeadDelivery } from './lead-delivery';
import { LeadNotificationScheduler } from './lead-notification.scheduler';
import { LeadTelegramDelivery } from './lead-telegram.delivery';
import { InMemoryLeadDeliveryRepository } from './test/in-memory-lead-delivery.repository';

const catalog = new MessageCatalog(MessagesDirectory.locate());
const texts = new TelegramTexts(
  new SiteMessagesService(new InMemorySiteMessageRows(), new Clock(), catalog),
  catalog,
  new MessageFormatter(),
);
/** The owner-facing copy: telegram.* of shared/messages/ru.json. */
const copy = (key: string): string => catalog.siteDefault(`telegram.${key}`, Locale.RU);

const LIVE: TelegramOptions = {
  token: '123456789:AAFakeTokenForTests_abcdefghijklmnop',
  chatId: '424242',
  dryRun: false,
  siteUrl: '',
  isProduction: false,
  retries: 0,
};

const lead: TelegramLead = {
  id: '0199f2c4-1111-7000-8000-000000000001',
  type: LeadType.CONTACT,
  name: 'Иван',
  email: 'ivan@mail.ru',
  phone: null,
  message: 'Привет',
  locale: 'ru',
  createdAt: new Date('2026-10-16T09:30:00.000Z'),
};

class NoSleep implements ISleeper {
  async sleep(): Promise<void> {}
}

function deliveryWith(fetch: TelegramFetch, options: Partial<TelegramOptions> = {}) {
  const telegram = { ...LIVE, ...options };
  const transport = new TelegramTransport(telegram, fetch, new NoSleep(), texts);
  const notifier = new TelegramLeadNotifier(telegram, transport, new LeadMessageFormatter(texts), texts);
  const repository = new InMemoryLeadDeliveryRepository();
  return { delivery: new LeadTelegramDelivery(notifier, repository), repository, notifier };
}

/** A delivery that breaks its promise never to throw. */
class CrashingDelivery extends LeadTelegramDelivery {
  attempts = 0;

  override async deliver(): Promise<LeadDelivery> {
    this.attempts += 1;
    throw new Error('telegram exploded');
  }
}

const answer = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('LeadTelegramDelivery', () => {
  it('a dry run is not a delivery: stored «not sent» with the dry-run notice, no network', async () => {
    const fetch = mock.fn<TelegramFetch>();
    const { delivery, repository } = deliveryWith(fetch, { dryRun: true });
    const outcome = await delivery.deliver(lead);
    deepStrictEqual(outcome, { telegramSent: false, telegramError: copy('errors.dryRun') });
    deepStrictEqual(repository.deliveries.get(lead.id), outcome);
    strictEqual(fetch.mock.callCount(), 0);
  });

  it('records a real delivery as sent', async () => {
    const { delivery, repository } = deliveryWith(mock.fn<TelegramFetch>(async () => answer({ ok: true, result: {} })));
    deepStrictEqual(await delivery.deliver(lead), { telegramSent: true, telegramError: null });
    deepStrictEqual(repository.deliveries.get(lead.id), { telegramSent: true, telegramError: null });
  });

  it('keeps the lead and records the owner-facing error when Telegram refuses', async () => {
    const blocked = mock.fn<TelegramFetch>(async () =>
      answer({ ok: false, description: 'Forbidden: bot was blocked by the user' }, 403),
    );
    const { delivery, repository } = deliveryWith(blocked);
    const error = 'Telegram отклонил сообщение (код 403): Forbidden: bot was blocked by the user';
    deepStrictEqual(await delivery.deliver(lead), { telegramSent: false, telegramError: error });
    deepStrictEqual(repository.deliveries.get(lead.id), { telegramSent: false, telegramError: error });
  });

  it('never throws, even when the outcome cannot be stored', async () => {
    const { delivery, repository } = deliveryWith(mock.fn<TelegramFetch>(), { dryRun: true });
    repository.failWith(new Error('database down'));
    deepStrictEqual(await delivery.deliver(lead), { telegramSent: false, telegramError: copy('errors.dryRun') });
  });
});

describe('LeadNotificationScheduler', () => {
  it('notifies in the background and lets the shutdown wait for it', async () => {
    const { delivery, repository } = deliveryWith(mock.fn<TelegramFetch>(), { dryRun: true });
    const scheduler = new LeadNotificationScheduler(delivery);
    scheduler.schedule(lead);
    strictEqual(repository.deliveries.size, 0, 'not before the caller goes on');
    await scheduler.onModuleDestroy();
    deepStrictEqual(repository.deliveries.get(lead.id), { telegramSent: false, telegramError: copy('errors.dryRun') });
  });

  it('survives a delivery that crashes (no unhandled rejection)', async () => {
    const { notifier, repository } = deliveryWith(mock.fn<TelegramFetch>(), { dryRun: true });
    const crashing = new CrashingDelivery(notifier, repository);
    const scheduler = new LeadNotificationScheduler(crashing);
    scheduler.schedule(lead);
    await scheduler.onModuleDestroy();
    strictEqual(crashing.attempts, 1);
  });
});
