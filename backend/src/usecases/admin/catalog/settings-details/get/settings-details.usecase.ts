import { Injectable } from '@nestjs/common';

import { SITE_SETTINGS_DEFAULTS } from '~core/catalog/site-settings.defaults';
import { Usecase } from '~usecases/usecase.interfaces';

import { SettingsDetailsRepository } from './settings-details.repository';
import { SettingsDetailsResponse } from './settings-details.response';

/** The settings form: the stored settings, or the defaults before the first save. */
@Injectable()
export class SettingsDetailsUsecase implements Usecase<void, SettingsDetailsResponse> {
  constructor(private readonly repository: SettingsDetailsRepository) {}

  async execute(): Promise<SettingsDetailsResponse> {
    const settings = await this.repository.findSettings();
    return SettingsDetailsResponse.of(settings ?? { ...SITE_SETTINGS_DEFAULTS, ogImage: null });
  }
}
