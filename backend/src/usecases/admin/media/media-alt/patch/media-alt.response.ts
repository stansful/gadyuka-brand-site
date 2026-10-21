import { ApiProperty } from '@nestjs/swagger';

import type { LocalizedText } from '~shared/contracts/common';
import type { MediaAltResponse as MediaAltResponseContract } from '~shared/contracts/media';

/** The stored alt text of a media file. */
export class MediaAltResponse implements MediaAltResponseContract {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: { ru: 'Белое худи', en: 'White hoodie' }, description: 'Empty translations are dropped' })
  alt: LocalizedText;

  static of(fields: Pick<MediaAltResponse, 'id' | 'alt'>): MediaAltResponse {
    return Object.assign(new MediaAltResponse(), fields);
  }
}
