import { Injectable } from '@nestjs/common';

import { MAX_ADMIN_LIST_ROWS } from '~core/content-entities/content-limits.constants';
import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { DatabaseService } from '~database';
import { Prisma } from '~prisma-generated/prisma/client';
import { MediaRefRecord } from '~usecases/admin/common/media/media-ref.record';

import { PartnerFields, PartnerRecord } from './partner.records';

const PARTNER_SELECT = {
  id: true,
  name: true,
  url: true,
  description: true,
  published: true,
  logo: { select: MediaRefRecord.SELECT },
} as const satisfies Prisma.PartnerSelect;

type PartnerRow = Prisma.PartnerGetPayload<{ select: typeof PARTNER_SELECT }>;

/** Partners of the admin (partners). */
@Injectable()
export class PartnerRepository {
  constructor(private readonly database: DatabaseService) {}

  /** In the manual order (then the older first). */
  async findList(): Promise<PartnerRecord[]> {
    const rows = await this.database.client.partner.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      take: MAX_ADMIN_LIST_ROWS,
      select: PARTNER_SELECT,
    });
    return rows.map(row => this.toRecord(row));
  }

  async findById(id: string): Promise<PartnerRecord | undefined> {
    const row = await this.database.client.partner.findUnique({ where: { id }, select: PARTNER_SELECT });
    return row === null ? undefined : this.toRecord(row);
  }

  /** The highest order of the partners (null: no partners yet). */
  async findMaxOrder(): Promise<number | null> {
    const result = await this.database.client.partner.aggregate({ _max: { order: true } });
    return result._max.order;
  }

  async create(fields: PartnerFields, order: number): Promise<string> {
    const row = await this.database.client.partner.create({ data: { ...fields, order }, select: { id: true } });
    return row.id;
  }

  /** A missing row → Prisma P2025 → 404 notFound (ApiExceptionFilter). */
  async update(id: string, fields: PartnerFields): Promise<void> {
    await this.database.client.partner.update({ where: { id }, data: fields, select: { id: true } });
  }

  private toRecord(row: PartnerRow): PartnerRecord {
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      logo: MediaRefRecord.toNullableMediaRef(row.logo),
      description: LocalizedTextValue.parse(row.description),
      published: row.published,
    };
  }
}
