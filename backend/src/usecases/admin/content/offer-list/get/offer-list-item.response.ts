import { ApiProperty } from '@nestjs/swagger';

import type { LocalizedText } from '~shared/contracts/common';
import type { AdminOfferListItem, CalendarDay } from '~shared/contracts/content-entities';

import { MoscowCalendar } from '~core/content-entities/moscow-calendar';
import { OfferValidity } from '~core/content-entities/offer-validity';
import { LocalizedTextSchema } from '~usecases/admin/common/fields/localized-text.schema';
import { MediaRefResponse } from '~usecases/admin/common/media/media-ref.response';
import { OfferListRecord } from '~usecases/admin/content/common/offers/offer.records';

/** A row of the admin's offer list. */
export class OfferListItemResponse implements AdminOfferListItem {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty(LocalizedTextSchema.of('Headline'))
  title: LocalizedText;

  @ApiProperty(LocalizedTextSchema.of('Badge'))
  badge: LocalizedText;

  @ApiProperty({ type: String, format: 'date', nullable: true, description: 'Last day (Moscow), null = no end' })
  validUntil: CalendarDay | null;

  @ApiProperty({ description: 'The last day is over: the site no longer shows the offer' })
  expired: boolean;

  @ApiProperty({ type: MediaRefResponse, nullable: true })
  image: MediaRefResponse | null;

  @ApiProperty()
  published: boolean;

  static of(record: OfferListRecord, now: Date): OfferListItemResponse {
    const { id, title, badge, image, published } = record;
    const validUntil = record.validUntil === null ? null : MoscowCalendar.dayOf(record.validUntil);
    const expired = new OfferValidity(record.validUntil).isExpiredAt(now);
    return Object.assign(new OfferListItemResponse(), { id, title, badge, validUntil, expired, image, published });
  }
}
