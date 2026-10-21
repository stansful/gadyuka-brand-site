import { ApiProperty } from '@nestjs/swagger';

import type { SiteTextGroup } from '~shared/contracts/site-texts';

import { SiteImageEntryResponse } from './site-image-entry.response';
import { SiteTextEntryResponse } from './site-text-entry.response';

/** One section of the editor, or the search matches of one section (no images in a search). */
export class SiteTextGroupResponse implements SiteTextGroup {
  @ApiProperty({ example: 'hero', description: 'admin.siteTexts.sections.<id>' })
  section: string;

  @ApiProperty({ type: () => [SiteTextEntryResponse] })
  entries: SiteTextEntryResponse[];

  @ApiProperty({ type: () => [SiteImageEntryResponse] })
  images: SiteImageEntryResponse[];

  static of(
    section: string,
    entries: SiteTextEntryResponse[],
    images: SiteImageEntryResponse[],
  ): SiteTextGroupResponse {
    return Object.assign(new SiteTextGroupResponse(), { section, entries, images });
  }
}
