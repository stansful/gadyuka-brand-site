import { Injectable } from '@nestjs/common';

import { MAX_ADMIN_LIST_ROWS } from '~core/content-entities/content-limits.constants';
import { LocalizedTextValue } from '~core/locales/localized-text-value';
import { DatabaseService } from '~database';
import { Prisma } from '~prisma-generated/prisma/client';
import { MediaRefRecord } from '~usecases/admin/common/media/media-ref.record';

import { NewsFields, NewsListRecord, NewsRecord } from './news.records';

const NEWS_LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  date: true,
  published: true,
  image: { select: MediaRefRecord.SELECT },
} as const satisfies Prisma.NewsItemSelect;

const NEWS_SELECT = { ...NEWS_LIST_SELECT, excerpt: true, body: true } as const satisfies Prisma.NewsItemSelect;

type NewsListRow = Prisma.NewsItemGetPayload<{ select: typeof NEWS_LIST_SELECT }>;
type NewsRow = Prisma.NewsItemGetPayload<{ select: typeof NEWS_SELECT }>;

/** News items of the admin (news_items). */
@Injectable()
export class NewsRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Newest first: by date, then by creation (the site's order). */
  async findList(): Promise<NewsListRecord[]> {
    const rows = await this.database.client.newsItem.findMany({
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: MAX_ADMIN_LIST_ROWS,
      select: NEWS_LIST_SELECT,
    });
    return rows.map(row => this.toListRecord(row));
  }

  async findById(id: string): Promise<NewsRecord | undefined> {
    const row = await this.database.client.newsItem.findUnique({ where: { id }, select: NEWS_SELECT });
    return row === null ? undefined : this.toRecord(row);
  }

  /** The id of the news item that has `slug`. */
  async findIdBySlug(slug: string): Promise<string | undefined> {
    const row = await this.database.client.newsItem.findUnique({ where: { slug }, select: { id: true } });
    return row?.id;
  }

  async create(fields: NewsFields): Promise<string> {
    const row = await this.database.client.newsItem.create({ data: fields, select: { id: true } });
    return row.id;
  }

  /** A missing row → Prisma P2025 → 404 notFound (ApiExceptionFilter). */
  async update(id: string, fields: NewsFields): Promise<void> {
    await this.database.client.newsItem.update({ where: { id }, data: fields, select: { id: true } });
  }

  private toListRecord(row: NewsListRow): NewsListRecord {
    return {
      id: row.id,
      slug: row.slug,
      title: LocalizedTextValue.parse(row.title),
      date: row.date,
      image: MediaRefRecord.toNullableMediaRef(row.image),
      published: row.published,
    };
  }

  private toRecord(row: NewsRow): NewsRecord {
    return {
      ...this.toListRecord(row),
      excerpt: LocalizedTextValue.parse(row.excerpt),
      body: LocalizedTextValue.parse(row.body),
    };
  }
}
