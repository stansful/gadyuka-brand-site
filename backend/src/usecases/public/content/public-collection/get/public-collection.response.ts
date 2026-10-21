import { ApiProperty } from '@nestjs/swagger';

import type {
  PublicCollection,
  PublicCollectionResponse as PublicCollectionResponseContract,
} from '~shared/contracts/content';

import { Locale } from '~core/locales/locale.enum';
import { PublicCollectionView } from '~usecases/public/content/common/views/public-collection.view';

/** Answer of GET /public/collections/:slug?locale=. */
export class PublicCollectionResponse implements PublicCollectionResponseContract {
  @ApiProperty({ enum: Locale })
  locale: Locale;

  @ApiProperty({ type: () => PublicCollectionView })
  collection: PublicCollection;

  static of(locale: Locale, collection: PublicCollection): PublicCollectionResponse {
    return Object.assign(new PublicCollectionResponse(), { locale, collection });
  }
}
