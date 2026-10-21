import { Injectable, Logger } from '@nestjs/common';

import { DEFAULT_LOCALE } from '~core/locales/locale.enum';
import { MessageCatalog, MessageFormatter } from '~module/messages';
import { SiteMessagesService } from '~module/site-messages';

import { TelegramMessageKey } from './telegram-message-key.enum';

type TelegramTextValues = Readonly<Record<string, string | number>>;

/**
 * The owner-facing copy of the notifications: the telegram.* site messages — the admin's edits
 * (Message rows) over the shared/messages defaults, SiteMessagesService — always in the default
 * locale (the owner reads Russian whatever the visitor's language), ICU arguments filled in.
 *
 * `text()` is synchronous (the transport and the formatter cannot await): it reads the last loaded
 * messages. Call `await load()` before formatting — TelegramLeadNotifier.notify does it itself; a
 * flow that only needs a status text (e.g. the notify ceiling of the leads slice) calls it too.
 */
@Injectable()
export class TelegramTexts {
  private static readonly NAMESPACE = 'telegram';
  private readonly logger = new Logger(TelegramTexts.name);

  constructor(
    private readonly siteMessages: SiteMessagesService,
    private readonly catalog: MessageCatalog,
    private readonly formatter: MessageFormatter,
  ) {}

  /** Refreshes the texts (cached). A failed read keeps the last loaded / default texts: a notification is never lost to it. */
  async load(): Promise<void> {
    try {
      await this.siteMessages.findValues(DEFAULT_LOCALE);
    } catch (error: unknown) {
      this.logger.warn('TelegramTexts : site messages unavailable, using the last loaded texts', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  text(key: TelegramMessageKey, values: TelegramTextValues = {}): string {
    const fullKey = `${TelegramTexts.NAMESPACE}.${key}`;
    const template = this.siteMessages.snapshotOf(DEFAULT_LOCALE)[fullKey] ?? '';
    try {
      return this.formatter.format(template, DEFAULT_LOCALE, values);
    } catch {
      this.logger.warn('TelegramTexts : edited text cannot be formatted, using the default', { key: fullKey });
      return this.formatter.format(this.catalog.siteDefault(fullKey, DEFAULT_LOCALE), DEFAULT_LOCALE, values);
    }
  }
}
