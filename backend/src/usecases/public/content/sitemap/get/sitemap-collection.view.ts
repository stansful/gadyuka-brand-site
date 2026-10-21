import { ApiProperty } from '@nestjs/swagger';

import type { SitemapCollection } from '~shared/contracts/content';

/** Swagger schema of one collection page of the sitemap (shared/contracts/content.ts). */
export class SitemapCollectionView implements SitemapCollection {
  @ApiProperty({ example: 'noir' })
  slug: string;

  @ApiProperty({ description: 'ISO 8601: the latest change of anything the page renders' })
  lastModified: string;
}
