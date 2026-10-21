import { Locale } from '~core/locales/locale.enum';

import { ISiteMessageRows, SiteMessageRow } from '../site-messages.interfaces';

/** ISiteMessageRows for unit tests: rows in memory, the number of reads counted, failures on demand. */
export class InMemorySiteMessageRows implements ISiteMessageRows {
  private rows: SiteMessageRow[] = [];
  private failure: Error | undefined;
  private reads = 0;

  get readCount(): number {
    return this.reads;
  }

  replaceRows(rows: readonly SiteMessageRow[]): void {
    this.rows = [...rows];
  }

  failWith(error: Error | undefined): void {
    this.failure = error;
  }

  async findByLocales(locales: readonly Locale[]): Promise<SiteMessageRow[]> {
    this.reads += 1;
    if (this.failure !== undefined) {
      throw this.failure;
    }
    return this.rows.filter(row => (locales as readonly string[]).includes(row.locale));
  }
}
