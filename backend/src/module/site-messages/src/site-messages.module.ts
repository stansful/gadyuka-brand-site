import { Module } from '@nestjs/common';

import { Clock } from '~module/common';
import { MessagesModule } from '~module/messages';

import { SiteMessageRowsRepository } from './site-message-rows.repository';
import { SITE_MESSAGE_ROWS, SITE_MESSAGES_CLOCK } from './site-messages.constants';
import { SiteMessagesService } from './site-messages.service';

/**
 * The resolved site messages (one SiteMessagesService per app: a static module is a singleton, so
 * the public messages endpoint, the Telegram texts and the admin texts slice share one cache).
 * Needs the global DatabaseService.
 */
@Module({
  imports: [MessagesModule],
  providers: [
    { provide: SITE_MESSAGE_ROWS, useClass: SiteMessageRowsRepository },
    { provide: SITE_MESSAGES_CLOCK, useClass: Clock },
    SiteMessagesService,
  ],
  exports: [SiteMessagesService],
})
export class SiteMessagesModule {}
