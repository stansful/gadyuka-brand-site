import { ApiProperty } from '@nestjs/swagger';

import type { AdminCatalogRowSaved } from '~shared/contracts/catalog';

/** Answer of a create / update of a collection, product or review: the id of the saved row. */
export class CatalogRowSavedResponse implements AdminCatalogRowSaved {
  @ApiProperty({ format: 'uuid' })
  id: string;

  static of(id: string): CatalogRowSavedResponse {
    return Object.assign(new CatalogRowSavedResponse(), { id });
  }
}
