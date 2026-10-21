import { Injectable } from '@nestjs/common';

import { MAX_ADMIN_LIST_ROWS } from '~core/content-entities/content-limits.constants';
import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { DatabaseService } from '~database';
import { Prisma } from '~prisma-generated/prisma/client';

import { SocialLinkFields, SocialLinkRecord } from './social-link.records';

const SOCIAL_LINK_SELECT = {
  id: true,
  type: true,
  label: true,
  url: true,
  published: true,
} as const satisfies Prisma.SocialLinkSelect;

type SocialLinkRow = Prisma.SocialLinkGetPayload<{ select: typeof SOCIAL_LINK_SELECT }>;

/** Social / messenger links of the contacts section (social_links). */
@Injectable()
export class SocialLinkRepository {
  constructor(private readonly database: DatabaseService) {}

  /** In the manual order (then the older first). */
  async findList(): Promise<SocialLinkRecord[]> {
    const rows = await this.database.client.socialLink.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      take: MAX_ADMIN_LIST_ROWS,
      select: SOCIAL_LINK_SELECT,
    });
    return rows.map(row => this.toRecord(row));
  }

  async findById(id: string): Promise<SocialLinkRecord | undefined> {
    const row = await this.database.client.socialLink.findUnique({ where: { id }, select: SOCIAL_LINK_SELECT });
    return row === null ? undefined : this.toRecord(row);
  }

  /** The highest order of the links (null: no links yet). */
  async findMaxOrder(): Promise<number | null> {
    const result = await this.database.client.socialLink.aggregate({ _max: { order: true } });
    return result._max.order;
  }

  async create(fields: SocialLinkFields, order: number): Promise<string> {
    const row = await this.database.client.socialLink.create({ data: { ...fields, order }, select: { id: true } });
    return row.id;
  }

  /** A missing row → Prisma P2025 → 404 notFound (ApiExceptionFilter). */
  async update(id: string, fields: SocialLinkFields): Promise<void> {
    await this.database.client.socialLink.update({ where: { id }, data: fields, select: { id: true } });
  }

  private toRecord(row: SocialLinkRow): SocialLinkRecord {
    return { ...row, label: LocalizedTextValue.parse(row.label) };
  }
}
