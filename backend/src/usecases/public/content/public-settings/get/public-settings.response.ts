import { ApiProperty } from '@nestjs/swagger';

import type {
  PublicSettings,
  PublicSettingsResponse as PublicSettingsResponseContract,
} from '~shared/contracts/content';

import { Locale } from '~core/locales/locale.enum';
import { PublicSettingsView } from '~usecases/public/content/common/views/public-settings.view';

/** Answer of GET /public/settings/:locale. */
export class PublicSettingsResponse implements PublicSettingsResponseContract {
  @ApiProperty({ enum: Locale })
  locale: Locale;

  @ApiProperty({ type: () => PublicSettingsView })
  settings: PublicSettings;

  static of(locale: Locale, settings: PublicSettings): PublicSettingsResponse {
    return Object.assign(new PublicSettingsResponse(), { locale, settings });
  }
}
