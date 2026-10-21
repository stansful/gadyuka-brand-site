import { Locale } from '~core/locales/locale.enum';
import { StoredSiteImage } from '~core/site-texts/site-image-save.planner';
import { StoredSiteText } from '~core/site-texts/site-text-row-index';
import { DatabaseService } from '~database';

import { TestMediaRows } from './test-media-rows';

/** What an e2e file writes: its own message keys and landing images (no other e2e file uses them). */
export interface SiteTextFixtureScope {
  readonly keys: readonly string[];
  readonly imageKeys: readonly string[];
}

/** The rows of the scope as the file found them. */
interface SiteTextSnapshot {
  readonly messages: readonly StoredSiteText[];
  readonly images: readonly StoredSiteImage[];
}

/**
 * Message / ContentImage rows of one e2e file in the test database: the rows of its keys are captured
 * first and put back by `restore()` (with the media it created removed), so the file leaves the shared
 * test database as it found it.
 */
export class SiteTextFixtures {
  private readonly media: TestMediaRows;

  private constructor(
    private readonly database: DatabaseService,
    private readonly scope: SiteTextFixtureScope,
    private readonly captured: SiteTextSnapshot,
  ) {
    this.media = new TestMediaRows(database);
  }

  static async capture(database: DatabaseService, scope: SiteTextFixtureScope): Promise<SiteTextFixtures> {
    const messages = await database.client.message.findMany({
      where: { key: { in: [...scope.keys] } },
      select: { key: true, locale: true, value: true, editedAt: true },
    });
    const images = await database.client.contentImage.findMany({
      where: { key: { in: [...scope.imageKeys] } },
      select: { key: true, mediaId: true },
    });
    return new SiteTextFixtures(database, scope, { messages, images });
  }

  /** Removes every row of the scope (the site then shows the defaults, no image). */
  async clear(): Promise<void> {
    await this.database.client.message.deleteMany({ where: { key: { in: [...this.scope.keys] } } });
    await this.database.client.contentImage.deleteMany({ where: { key: { in: [...this.scope.imageKeys] } } });
  }

  async store(row: StoredSiteText): Promise<void> {
    const data = { value: row.value, editedAt: row.editedAt };
    await this.database.client.message.upsert({
      where: { key_locale: { key: row.key, locale: row.locale } },
      create: { key: row.key, locale: row.locale, ...data },
      update: data,
      select: { key: true },
    });
  }

  find(key: string, locale: Locale): Promise<StoredSiteText | null> {
    return this.database.client.message.findUnique({
      where: { key_locale: { key, locale } },
      select: { key: true, locale: true, value: true, editedAt: true },
    });
  }

  async storeImage(image: StoredSiteImage): Promise<void> {
    await this.database.client.contentImage.upsert({
      where: { key: image.key },
      create: { key: image.key, mediaId: image.mediaId },
      update: { mediaId: image.mediaId },
      select: { key: true },
    });
  }

  async findImageMedia(key: string): Promise<string | null | undefined> {
    const row = await this.database.client.contentImage.findUnique({ where: { key }, select: { mediaId: true } });
    return row === null ? undefined : row.mediaId;
  }

  /** A media library row owned by `adminId` (removed by `restore()`). */
  createMedia(adminId: string): Promise<string> {
    return this.media.create(adminId);
  }

  /** Puts the captured rows back and removes the created media. */
  async restore(): Promise<void> {
    await this.clear();
    await this.media.remove();
    await this.database.client.message.createMany({ data: [...this.captured.messages] });
    await this.database.client.contentImage.createMany({ data: [...this.captured.images] });
  }
}
