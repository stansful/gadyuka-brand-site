import { randomUUID } from 'node:crypto';

import { UserRole } from '~core/users/user-role';
import { DatabaseService } from '~database';

/** Media library rows of an e2e file (no files: the admin APIs under test only read the rows), removed by `remove()`. */
export class TestMediaRows {
  /** A picture row as an upload stores it (the alt holds a stray locale and a non-text the API drops). */
  private static readonly MEDIA = {
    bucket: 'e2e',
    mime: 'image/webp',
    width: 1200,
    height: 800,
    size: 1024,
    alt: { ru: 'Фото', en: 'Photo', de: 'ignored', fr: 1 },
  };

  private readonly ids: string[] = [];

  constructor(private readonly database: DatabaseService) {}

  /** A row owned by the admin `adminId`. */
  async create(adminId: string): Promise<string> {
    const uuid = randomUUID();
    const key = `admin/${adminId}/${uuid}/image.webp`;
    const owner = { ownerType: UserRole.ADMIN, ownerId: adminId };
    const data = { ...TestMediaRows.MEDIA, ...owner, uuid, key, url: `/media/${key}` };
    const media = await this.database.client.media.create({ data, select: { id: true } });
    this.ids.push(media.id);
    return media.id;
  }

  async remove(): Promise<void> {
    await this.database.client.media.deleteMany({ where: { id: { in: this.ids } } });
  }
}
