import { ApiProperty } from '@nestjs/swagger';

import type { SiteTextsSaveResponse as SiteTextsSaveResponseContract } from '~shared/contracts/site-texts';

import { SiteTextValuesByKey } from '~core/site-texts/site-text-save.planner';

/** What a save stored. */
export interface SavedSiteTexts {
  /** Rows written (texts + images) */
  readonly saved: number;
  readonly values: SiteTextValuesByKey;
}

/** Answer of PUT /admin/site-texts. */
export class SiteTextsSaveResponse implements SiteTextsSaveResponseContract {
  @ApiProperty({ description: 'Rows written (texts + images); 0 = nothing changed', example: 1 })
  saved: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'object', additionalProperties: { type: 'string' } },
    description: 'What every submitted text holds after the save, per key and language',
    example: { 'hero.slogan': { ru: 'Меня запомнят' } },
  })
  values: SiteTextValuesByKey;

  static of({ saved, values }: SavedSiteTexts): SiteTextsSaveResponse {
    return Object.assign(new SiteTextsSaveResponse(), { saved, values });
  }
}
