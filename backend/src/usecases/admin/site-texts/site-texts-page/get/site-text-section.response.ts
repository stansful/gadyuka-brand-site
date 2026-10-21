import { ApiProperty } from '@nestjs/swagger';

import type { SiteTextSectionSummary } from '~shared/contracts/site-texts';

import { SiteTextCounters } from '~core/site-texts/site-text-counters';

/** A tab of the section bar with its counters. */
export class SiteTextSectionResponse implements SiteTextSectionSummary {
  @ApiProperty({ example: 'hero' })
  id: string;

  @ApiProperty()
  total: number;

  @ApiProperty({ description: 'Texts edited in the admin (any locale)' })
  edited: number;

  @ApiProperty({ description: 'Texts with a Russian text and an empty translation' })
  gaps: number;

  @ApiProperty({ description: 'Texts without a row in some locale (the default is shown)' })
  unsaved: number;

  static of(id: string, counters: SiteTextCounters): SiteTextSectionResponse {
    const { total, edited, gaps, unsaved } = counters;
    return Object.assign(new SiteTextSectionResponse(), { id, total, edited, gaps, unsaved });
  }
}
