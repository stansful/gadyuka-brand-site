import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';
import { MediaRefRecord, MediaRefRow } from '~usecases/admin/common/media/media-ref.record';

/** A ContentImage row with its media (null = none picked, or the media was deleted). */
export interface SiteImageRow {
  readonly key: string;
  readonly media: MediaRefRow | null;
}

/** The landing images of a section (a handful of keys from the registry). */
@Injectable()
export class SiteTextsPageRepository {
  constructor(private readonly database: DatabaseService) {}

  findImages(keys: readonly string[]): Promise<SiteImageRow[]> {
    return this.database.client.contentImage.findMany({
      where: { key: { in: [...keys] } },
      select: { key: true, media: { select: MediaRefRecord.SELECT } },
    });
  }
}
