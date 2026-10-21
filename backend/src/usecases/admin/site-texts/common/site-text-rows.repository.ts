import { Injectable } from '@nestjs/common';

import { LocaleMap } from '~core/locales/locale-map';
import { StoredSiteText } from '~core/site-texts/site-text-row-index';
import { DatabaseService } from '~database';

/**
 * Message rows as the admin reads them (with Message.editedAt). Bounded without a limit clause: the key
 * set is shared/messages (a few hundred keys per locale) — the seed and the admin never create others.
 */
@Injectable()
export class SiteTextRowsRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Every row of the configured locales (orphan keys included: nobody asks for them). */
  findAll(): Promise<StoredSiteText[]> {
    return this.database.client.message.findMany({
      where: { locale: { in: [...LocaleMap.LOCALES] } },
      select: { key: true, locale: true, value: true, editedAt: true },
    });
  }
}
