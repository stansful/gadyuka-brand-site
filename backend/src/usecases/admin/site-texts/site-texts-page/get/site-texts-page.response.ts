import { ApiProperty } from '@nestjs/swagger';

import type { SiteTextsPageResponse as SiteTextsPageResponseContract } from '~shared/contracts/site-texts';

import { SiteTextGroupResponse } from './site-text-group.response';
import { SiteTextSectionResponse } from './site-text-section.response';

type PageMode = SiteTextsPageResponseContract['mode'];

/** Answer of GET /admin/site-texts: the section tabs, plus one section or the search matches. */
export class SiteTextsPageResponse implements SiteTextsPageResponseContract {
  @ApiProperty({ type: () => [SiteTextSectionResponse] })
  sections: SiteTextSectionResponse[];

  @ApiProperty({ enum: ['section', 'search'] })
  mode: PageMode;

  @ApiProperty({ type: String, nullable: true, description: 'The active section in section mode' })
  section: string | null;

  @ApiProperty({ description: 'The normalized query in search mode, else ""' })
  query: string;

  @ApiProperty({ type: () => [SiteTextGroupResponse] })
  groups: SiteTextGroupResponse[];

  /** One section with its images (`group` undefined: there are no texts at all). */
  static ofSection(
    sections: SiteTextSectionResponse[],
    group: SiteTextGroupResponse | undefined,
  ): SiteTextsPageResponse {
    const section = group === undefined ? null : group.section;
    const groups = group === undefined ? [] : [group];
    return Object.assign(new SiteTextsPageResponse(), { sections, mode: 'section', section, query: '', groups });
  }

  static ofSearch(
    sections: SiteTextSectionResponse[],
    query: string,
    groups: SiteTextGroupResponse[],
  ): SiteTextsPageResponse {
    return Object.assign(new SiteTextsPageResponse(), { sections, mode: 'search', section: null, query, groups });
  }
}
