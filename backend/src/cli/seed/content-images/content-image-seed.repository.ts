import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';

/** A landing image row: key → Media (null = no picture). */
export interface ContentImageLink {
  readonly key: string;
  readonly mediaId: string | null;
}

/** content_images rows for the seed (a handful of keys: read without a limit). */
@Injectable()
export class ContentImageSeedRepository {
  constructor(private readonly database: DatabaseService) {}

  async findExistingKeys(): Promise<Set<string>> {
    const rows = await this.database.client.contentImage.findMany({ select: { key: true } });
    return new Set(rows.map(row => row.key));
  }

  async create(link: ContentImageLink): Promise<void> {
    await this.database.client.contentImage.create({ data: link });
  }

  async updateMedia({ key, mediaId }: ContentImageLink): Promise<void> {
    await this.database.client.contentImage.update({ where: { key }, data: { mediaId } });
  }
}
