import { ApiProperty } from '@nestjs/swagger';

import type { SiteTextResetResponse } from '~shared/contracts/site-texts';

import { Locale } from '~core/locales/locale.enum';

/** Answer of POST /admin/site-texts/reset: the defaults now stored. */
export class SiteTextsResetResponse implements SiteTextResetResponse {
  @ApiProperty({ example: 'hero.title' })
  key: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    description: 'shared/messages/<locale>.json',
  })
  values: Record<Locale, string>;

  static of(key: string, values: Readonly<Record<Locale, string>>): SiteTextsResetResponse {
    return Object.assign(new SiteTextsResetResponse(), { key, values: { ...values } });
  }
}
