import { ApiProperty } from '@nestjs/swagger';

import type { SiteMessagesResponse as SiteMessagesResponseContract } from '~shared/contracts/content';

import { Locale } from '~core/locales/locale.enum';
import { MessageTree } from '~module/messages';

/** Answer of GET /public/messages/:locale. */
export class SiteMessagesResponse implements SiteMessagesResponseContract {
  @ApiProperty({ enum: Locale })
  locale: Locale;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'The nested tree of shared/messages/<locale>.json with the admin edits applied',
  })
  messages: MessageTree;

  static of(locale: Locale, messages: MessageTree): SiteMessagesResponse {
    return Object.assign(new SiteMessagesResponse(), { locale, messages });
  }
}
