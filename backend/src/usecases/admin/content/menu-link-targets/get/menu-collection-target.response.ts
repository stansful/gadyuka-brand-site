import { ApiProperty } from '@nestjs/swagger';

import type { LocalizedText } from '~shared/contracts/common';
import type { AdminMenuCollectionTarget } from '~shared/contracts/content-entities';

import { LocalizedTextSchema } from '~usecases/admin/common/fields/localized-text.schema';

/** A collection page the menu form suggests ("/catalog/<slug>"). */
export class MenuCollectionTargetResponse implements AdminMenuCollectionTarget {
  @ApiProperty({ example: 'menya-zapomnyat' })
  slug: string;

  @ApiProperty(LocalizedTextSchema.of('Title of the collection'))
  title: LocalizedText;
}
