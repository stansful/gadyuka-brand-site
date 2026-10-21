import { ApiProperty } from '@nestjs/swagger';

import type { LocalizedText } from '~shared/contracts/common';
import type { AdminPartnerDetails } from '~shared/contracts/content-entities';

import { LocalizedTextSchema } from '~usecases/admin/common/fields/localized-text.schema';
import { MediaRefResponse } from '~usecases/admin/common/media/media-ref.response';

import { PartnerRecord } from './partner.records';

/** A partner (rows of GET /admin/partners, GET /admin/partners/:id). */
export class PartnerDetailsResponse implements AdminPartnerDetails {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  url: string | null;

  @ApiProperty({ type: MediaRefResponse, nullable: true })
  logo: MediaRefResponse | null;

  @ApiProperty(LocalizedTextSchema.of('Description'))
  description: LocalizedText;

  @ApiProperty()
  published: boolean;

  static of({ id, name, url, logo, description, published }: PartnerRecord): PartnerDetailsResponse {
    return Object.assign(new PartnerDetailsResponse(), { id, name, url, logo, description, published });
  }
}
