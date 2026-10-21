import { ApiProperty } from '@nestjs/swagger';

import type { LocalizedText } from '~shared/contracts/common';
import type { AdminOfferDetails, CalendarDay } from '~shared/contracts/content-entities';

import { MoscowCalendar } from '~core/content-entities/moscow-calendar';
import { LocalizedTextSchema } from '~usecases/admin/common/fields/localized-text.schema';
import { MediaRefResponse } from '~usecases/admin/common/media/media-ref.response';

import { OfferRecord } from './offer.records';

/** A special offer in the edit form (GET /admin/offers/:id). */
export class OfferDetailsResponse implements AdminOfferDetails {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty(LocalizedTextSchema.of('Headline'))
  title: LocalizedText;

  @ApiProperty(LocalizedTextSchema.of('Text'))
  text: LocalizedText;

  @ApiProperty(LocalizedTextSchema.of('Badge'))
  badge: LocalizedText;

  @ApiProperty(LocalizedTextSchema.of('Button label'))
  ctaLabel: LocalizedText;

  @ApiProperty({ type: String, nullable: true, description: 'Button link' })
  ctaHref: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true, description: 'Last day (Moscow), null = no end' })
  validUntil: CalendarDay | null;

  @ApiProperty({ type: MediaRefResponse, nullable: true })
  image: MediaRefResponse | null;

  @ApiProperty()
  published: boolean;

  static of(record: OfferRecord): OfferDetailsResponse {
    const { id, title, text, badge, ctaLabel, ctaHref, image, published } = record;
    const validUntil = record.validUntil === null ? null : MoscowCalendar.dayOf(record.validUntil);
    const response = { id, title, text, badge, ctaLabel, ctaHref, validUntil, image, published };
    return Object.assign(new OfferDetailsResponse(), response);
  }
}
