import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';
import { Prisma } from '~prisma-generated/prisma/client';
import { MediaRecord } from '~usecases/admin/media/common/media-record';
import { MediaRecordMapper } from '~usecases/admin/media/common/media-record.mapper';

/** One page request: rows after `cursor` (a media id), at most `take`, matching `search` when given. */
export interface MediaPageQuery {
  readonly cursor: string | undefined;
  readonly search: string | undefined;
  readonly take: number;
}

@Injectable()
export class MediaListRepository {
  private static readonly ORDER: Prisma.MediaOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }];

  constructor(private readonly database: DatabaseService) {}

  /** Newest first; `take` rows at most. A cursor that no longer exists → an empty list. */
  async findPage({ cursor, search, take }: MediaPageQuery): Promise<MediaRecord[]> {
    const rows = await this.database.client.media.findMany({
      where: this.whereOf(search),
      orderBy: MediaListRepository.ORDER,
      take,
      ...(cursor !== undefined && { cursor: { id: cursor }, skip: 1 }),
      select: MediaRecordMapper.SELECT,
    });
    return rows.map(row => MediaRecordMapper.toRecord(row));
  }

  async countAll(): Promise<number> {
    return this.database.client.media.count();
  }

  /** The original file name contains `search`, ignoring case. */
  private whereOf(search: string | undefined): Prisma.MediaWhereInput {
    return search ? { originalName: { contains: search, mode: 'insensitive' } } : {};
  }
}
