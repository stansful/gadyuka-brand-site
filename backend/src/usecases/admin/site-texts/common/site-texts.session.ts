import { LocaleMap } from '~core/locales/locale-map';
import { StoredSiteImage } from '~core/site-texts/site-image-save.planner';
import { StoredSiteText } from '~core/site-texts/site-text-row-index';
import { SiteTextWrite } from '~core/site-texts/site-text-save.planner';
import { Prisma } from '~prisma-generated/prisma/client';

/**
 * The Message / ContentImage reads and writes of one locked «Тексты сайта» transaction (SiteTextsStore):
 * a save reads what it checks and writes it with no other save or reset in between. Writes run one by
 * one (one connection) in the order planned.
 */
export class SiteTextsSession {
  constructor(private readonly transaction: Prisma.TransactionClient) {}

  /** The rows of `keys` in the configured locales. */
  findMessages(keys: readonly string[]): Promise<StoredSiteText[]> {
    return this.transaction.message.findMany({
      where: { key: { in: [...new Set(keys)] }, locale: { in: [...LocaleMap.LOCALES] } },
      select: { key: true, locale: true, value: true, editedAt: true },
    });
  }

  findImages(keys: readonly string[]): Promise<StoredSiteImage[]> {
    return this.transaction.contentImage.findMany({
      where: { key: { in: [...keys] } },
      select: { key: true, mediaId: true },
    });
  }

  async saveMessages(writes: readonly SiteTextWrite[]): Promise<void> {
    for (const write of writes) {
      await this.transaction.message.upsert({
        where: { key_locale: { key: write.key, locale: write.locale } },
        create: { key: write.key, locale: write.locale, value: write.value, editedAt: write.editedAt },
        update: { value: write.value, editedAt: write.editedAt },
        select: { key: true },
      });
    }
  }

  async saveImages(writes: readonly StoredSiteImage[]): Promise<void> {
    for (const write of writes) {
      await this.transaction.contentImage.upsert({
        where: { key: write.key },
        create: { key: write.key, mediaId: write.mediaId },
        update: { mediaId: write.mediaId },
        select: { key: true },
      });
    }
  }
}
