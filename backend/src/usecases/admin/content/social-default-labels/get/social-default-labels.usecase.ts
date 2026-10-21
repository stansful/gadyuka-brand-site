import { Injectable } from '@nestjs/common';

import { LocaleMap } from '~core/locales/locale-map';
import { Locale } from '~core/locales/locale.enum';
import { FlatMessages } from '~module/messages';
import { SiteMessagesService } from '~module/site-messages';
import { Usecase } from '~usecases/usecase.interfaces';

import { SocialDefaultLabelsFactory } from './social-default-labels.factory';
import { SocialDefaultLabelsResponse } from './social-default-labels.response';

/** The default names of the social types (the hint and placeholder of the link form's label). */
@Injectable()
export class SocialDefaultLabelsUsecase implements Usecase<void, SocialDefaultLabelsResponse> {
  constructor(private readonly siteMessages: SiteMessagesService) {}

  async execute(): Promise<SocialDefaultLabelsResponse> {
    const messages = await Promise.all(LocaleMap.LOCALES.map(locale => this.messagesOf(locale)));
    return SocialDefaultLabelsResponse.of(SocialDefaultLabelsFactory.build(new Map(messages)));
  }

  private async messagesOf(locale: Locale): Promise<[Locale, FlatMessages]> {
    return [locale, await this.siteMessages.findValues(locale)];
  }
}
