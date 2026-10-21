import { Module } from '@nestjs/common';

import { ConfigService } from '~config';
import { Sleeper } from '~module/common';
import { MessagesModule } from '~module/messages';
import { SiteMessagesModule } from '~module/site-messages';

import { LeadMessageFormatter } from './lead-message.formatter';
import { TelegramLeadNotifier } from './telegram-lead.notifier';
import { TelegramOptionsFactory } from './telegram-options.factory';
import { TelegramTexts } from './telegram-texts';
import { TELEGRAM_FETCH, TELEGRAM_OPTIONS, TELEGRAM_SLEEPER } from './telegram.constants';
import { TelegramTransport } from './telegram.transport';

@Module({
  imports: [MessagesModule, SiteMessagesModule],
  providers: [
    { provide: TELEGRAM_OPTIONS, inject: [ConfigService], useFactory: TelegramOptionsFactory.fromConfig },
    { provide: TELEGRAM_FETCH, useValue: globalThis.fetch },
    { provide: TELEGRAM_SLEEPER, useClass: Sleeper },
    TelegramTexts,
    LeadMessageFormatter,
    TelegramTransport,
    TelegramLeadNotifier,
  ],
  exports: [TelegramLeadNotifier, TelegramTransport, LeadMessageFormatter, TelegramTexts],
})
export class TelegramModule {}
