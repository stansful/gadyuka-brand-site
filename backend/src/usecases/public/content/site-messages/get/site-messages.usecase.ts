import { Injectable } from '@nestjs/common';

import { Locale } from '~core/locales/locale.enum';
import { SiteMessagesService } from '~module/site-messages';
import { Usecase } from '~usecases/usecase.interfaces';

import { SiteMessagesResponse } from './site-messages.response';

export interface SiteMessagesQuery {
  readonly locale: Locale;
}

/** The site UI messages of a locale as the site shows them (admin edits over the defaults). */
@Injectable()
export class SiteMessagesUsecase implements Usecase<SiteMessagesQuery, SiteMessagesResponse> {
  constructor(private readonly siteMessages: SiteMessagesService) {}

  async execute({ locale }: SiteMessagesQuery): Promise<SiteMessagesResponse> {
    return SiteMessagesResponse.of(locale, await this.siteMessages.findTree(locale));
  }
}
