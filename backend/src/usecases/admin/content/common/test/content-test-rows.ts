import { randomUUID } from 'node:crypto';

import type { MediaRef } from '~shared/contracts/common';

import { MEDIA_MIME, MEDIA_URL_PREFIX } from '~core/media/media.constants';
import { UserRole } from '~core/users/user-role';
import { DatabaseService } from '~database';
import { Prisma } from '~prisma-generated/prisma/client';
import { MediaRefRecord } from '~usecases/admin/common/media/media-ref.record';

/** Tables of the content entities whose rows an e2e test creates. */
export type ContentTable = 'newsItem' | 'galleryItem' | 'offer' | 'partner' | 'menuItem' | 'socialLink';

/**
 * Throw-away rows of one e2e file in the slice's test database: media files (rows only — no object
 * in the storage) owned by the test admin, and the content rows the test created (`track`).
 * `remove()` deletes them all, content first (gallery items restrict their media), then the media.
 */
export class ContentTestRows {
  private readonly tracked = new Map<ContentTable, string[]>();
  private readonly mediaIds: string[] = [];
  private readonly deleters: Readonly<Record<ContentTable, (ids: string[]) => Promise<unknown>>>;

  constructor(
    private readonly database: DatabaseService,
    private readonly ownerId: string,
  ) {
    this.deleters = ContentTestRows.buildDeleters(database);
  }

  /** A media row with a public URL and the given alt texts. */
  async createMedia(alt: Readonly<Record<string, string>> = {}): Promise<MediaRef> {
    const row = await this.database.client.media.create({ data: this.mediaRow(alt), select: MediaRefRecord.SELECT });
    this.mediaIds.push(row.id);
    return MediaRefRecord.toMediaRef(row);
  }

  private mediaRow(alt: Readonly<Record<string, string>>): Prisma.MediaUncheckedCreateInput {
    const uuid = randomUUID();
    const key = `admin/${this.ownerId}/${uuid}/image.webp`;
    const owner = { ownerType: UserRole.ADMIN, ownerId: this.ownerId };
    return { ...owner, uuid, key, url: `${MEDIA_URL_PREFIX}/${key}`, alt, ...ContentTestRows.FILE };
  }

  /** Remembers a row created through the API (removed by `remove()`). */
  track(table: ContentTable, id: string): string {
    this.tracked.set(table, [...(this.tracked.get(table) ?? []), id]);
    return id;
  }

  async remove(): Promise<void> {
    for (const [table, ids] of this.tracked) {
      await this.deleters[table](ids);
    }
    await this.database.client.media.deleteMany({ where: { id: { in: this.mediaIds } } });
  }

  private static readonly FILE = { bucket: 'e2e', mime: MEDIA_MIME, width: 1200, height: 800, size: 1024 } as const;

  private static buildDeleters(database: DatabaseService): Record<ContentTable, (ids: string[]) => Promise<unknown>> {
    const { client } = database;
    return {
      newsItem: ids => client.newsItem.deleteMany({ where: { id: { in: ids } } }),
      galleryItem: ids => client.galleryItem.deleteMany({ where: { id: { in: ids } } }),
      offer: ids => client.offer.deleteMany({ where: { id: { in: ids } } }),
      partner: ids => client.partner.deleteMany({ where: { id: { in: ids } } }),
      menuItem: ids => client.menuItem.deleteMany({ where: { id: { in: ids } } }),
      socialLink: ids => client.socialLink.deleteMany({ where: { id: { in: ids } } }),
    };
  }
}
