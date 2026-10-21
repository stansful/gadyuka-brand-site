import { ApiProperty } from '@nestjs/swagger';

import type { PublishedCollectionsResponse as PublishedCollectionsResponseContract } from '~shared/contracts/content';

/** Answer of GET /public/collections. */
export class PublishedCollectionsResponse implements PublishedCollectionsResponseContract {
  @ApiProperty({ type: [String], example: ['noir', 'drop'], description: 'In the admin order (at most 200)' })
  slugs: string[];

  static of(slugs: string[]): PublishedCollectionsResponse {
    return Object.assign(new PublishedCollectionsResponse(), { slugs });
  }
}
