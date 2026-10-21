import { Injectable } from '@nestjs/common';

import { Locale } from '~core/locales/locale.enum';
import { PublicSettingsPresenter } from '~usecases/public/content/common/public-settings.presenter';
import { PublicSettingsRepository } from '~usecases/public/content/common/public-settings.repository';
import { Usecase } from '~usecases/usecase.interfaces';

import { PublicSettingsResponse } from './public-settings.response';

export interface PublicSettingsQuery {
  readonly locale: Locale;
}

/** The site settings for one locale: contacts, review scale, SEO defaults (port of getSiteSettings). */
@Injectable()
export class PublicSettingsUsecase implements Usecase<PublicSettingsQuery, PublicSettingsResponse> {
  constructor(
    private readonly repository: PublicSettingsRepository,
    private readonly presenter: PublicSettingsPresenter,
  ) {}

  async execute({ locale }: PublicSettingsQuery): Promise<PublicSettingsResponse> {
    const row = await this.repository.findSettings();
    return PublicSettingsResponse.of(locale, this.presenter.toSettings(row, locale));
  }
}
