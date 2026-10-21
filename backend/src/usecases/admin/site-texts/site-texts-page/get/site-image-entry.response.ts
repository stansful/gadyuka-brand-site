import { ApiProperty } from '@nestjs/swagger';

import type { SiteImageEntry } from '~shared/contracts/site-texts';

import { MediaRefResponse } from '~usecases/admin/common/media/media-ref.response';

/** A landing image (ContentImage row) of a section (the admin names it: admin.siteTexts.images.<key>). */
export class SiteImageEntryResponse implements SiteImageEntry {
  @ApiProperty({ example: 'about.image' })
  key: string;

  @ApiProperty({ type: () => MediaRefResponse, nullable: true })
  media: MediaRefResponse | null;

  static of(key: string, media: MediaRefResponse | null): SiteImageEntryResponse {
    return Object.assign(new SiteImageEntryResponse(), { key, media });
  }
}
