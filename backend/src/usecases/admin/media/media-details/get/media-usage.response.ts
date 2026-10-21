import { ApiProperty } from '@nestjs/swagger';

import type { MediaUsage } from '~shared/contracts/media';

import { MediaUsageKind } from '~core/media/media-usage-kind.enum';

/** One place that uses a media file. */
export class MediaUsageResponse implements MediaUsage {
  @ApiProperty({ enum: MediaUsageKind, description: 'What uses the file (admin.media.usages.<kind>)' })
  kind: MediaUsageKind;

  @ApiProperty({ example: '/admin/products/0199…', description: 'Admin page of the place' })
  href: string;

  @ApiProperty({ example: 'Худи «Меня запомнят»', description: 'Stored name of the place (ru); "" when none' })
  title: string;

  @ApiProperty({ type: String, nullable: true, example: 'about.image', description: 'Landing image key' })
  contentKey: string | null;

  static of(fields: Pick<MediaUsageResponse, 'kind' | 'href' | 'title' | 'contentKey'>): MediaUsageResponse {
    return Object.assign(new MediaUsageResponse(), fields);
  }
}
