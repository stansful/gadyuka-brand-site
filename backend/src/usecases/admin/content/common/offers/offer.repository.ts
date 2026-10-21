import { Injectable } from '@nestjs/common';

import { MAX_ADMIN_LIST_ROWS } from '~core/content-entities/content-limits.constants';
import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { DatabaseService } from '~database';
import { Prisma } from '~prisma-generated/prisma/client';
import { MediaRefRecord } from '~usecases/admin/common/media/media-ref.record';

import { OfferFields, OfferListRecord, OfferRecord } from './offer.records';

const OFFER_LIST_SELECT = {
  id: true,
  title: true,
  badge: true,
  validUntil: true,
  published: true,
  image: { select: MediaRefRecord.SELECT },
} as const satisfies Prisma.OfferSelect;

const OFFER_SELECT = {
  ...OFFER_LIST_SELECT,
  text: true,
  ctaLabel: true,
  ctaHref: true,
} as const satisfies Prisma.OfferSelect;

type OfferListRow = Prisma.OfferGetPayload<{ select: typeof OFFER_LIST_SELECT }>;
type OfferRow = Prisma.OfferGetPayload<{ select: typeof OFFER_SELECT }>;

/** Special offers of the admin (offers). */
@Injectable()
export class OfferRepository {
  constructor(private readonly database: DatabaseService) {}

  /** In the manual order (then the older first). */
  async findList(): Promise<OfferListRecord[]> {
    const rows = await this.database.client.offer.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      take: MAX_ADMIN_LIST_ROWS,
      select: OFFER_LIST_SELECT,
    });
    return rows.map(row => this.toListRecord(row));
  }

  async findById(id: string): Promise<OfferRecord | undefined> {
    const row = await this.database.client.offer.findUnique({ where: { id }, select: OFFER_SELECT });
    return row === null ? undefined : this.toRecord(row);
  }

  /** The highest order of the offers (null: no offers yet). */
  async findMaxOrder(): Promise<number | null> {
    const result = await this.database.client.offer.aggregate({ _max: { order: true } });
    return result._max.order;
  }

  async create(fields: OfferFields, order: number): Promise<string> {
    const row = await this.database.client.offer.create({ data: { ...fields, order }, select: { id: true } });
    return row.id;
  }

  /** A missing row → Prisma P2025 → 404 notFound (ApiExceptionFilter). */
  async update(id: string, fields: OfferFields): Promise<void> {
    await this.database.client.offer.update({ where: { id }, data: fields, select: { id: true } });
  }

  private toListRecord(row: OfferListRow): OfferListRecord {
    return {
      id: row.id,
      title: LocalizedTextValue.parse(row.title),
      badge: LocalizedTextValue.parse(row.badge),
      validUntil: row.validUntil,
      image: MediaRefRecord.toNullableMediaRef(row.image),
      published: row.published,
    };
  }

  private toRecord(row: OfferRow): OfferRecord {
    return {
      ...this.toListRecord(row),
      text: LocalizedTextValue.parse(row.text),
      ctaLabel: LocalizedTextValue.parse(row.ctaLabel),
      ctaHref: row.ctaHref,
    };
  }
}
