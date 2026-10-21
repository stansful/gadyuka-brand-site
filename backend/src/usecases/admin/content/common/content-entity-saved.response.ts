import { ApiProperty } from '@nestjs/swagger';

import type { ContentEntitySaved } from '~shared/contracts/content-entities';

/** Answer of every create / update of a content entity: the id of the saved row. */
export class ContentEntitySavedResponse implements ContentEntitySaved {
  @ApiProperty({ format: 'uuid' })
  id: string;

  static of(id: string): ContentEntitySavedResponse {
    return Object.assign(new ContentEntitySavedResponse(), { id });
  }
}
