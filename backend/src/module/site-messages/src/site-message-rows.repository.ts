import { Injectable } from '@nestjs/common';

import { Locale } from '~core/locales/locale.enum';
import { DatabaseService } from '~database';

import { ISiteMessageRows, SiteMessageRow } from './site-messages.interfaces';

/**
 * Message rows of the database. Bounded without a limit clause: the key set is shared/messages
 * (a few hundred keys per locale), the seed and the admin never create other keys.
 */
@Injectable()
export class SiteMessageRowsRepository implements ISiteMessageRows {
  constructor(private readonly database: DatabaseService) {}

  findByLocales(locales: readonly Locale[]): Promise<SiteMessageRow[]> {
    return this.database.client.message.findMany({
      where: { locale: { in: [...locales] } },
      select: { key: true, locale: true, value: true },
    });
  }
}
