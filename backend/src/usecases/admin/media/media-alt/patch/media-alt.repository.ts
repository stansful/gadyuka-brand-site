import { Injectable } from '@nestjs/common';

import type { LocalizedText } from '~shared/contracts/common';

import { DatabaseService } from '~database';

/** The new alt text of one media file. */
export interface MediaAltChange {
  readonly id: string;
  readonly alt: LocalizedText;
}

@Injectable()
export class MediaAltRepository {
  constructor(private readonly database: DatabaseService) {}

  /** A missing row → Prisma P2025 → 404 admin.errors.notFound (ApiExceptionFilter). */
  async updateAlt({ id, alt }: MediaAltChange): Promise<void> {
    await this.database.client.media.update({ where: { id }, data: { alt: { ...alt } }, select: { id: true } });
  }
}
