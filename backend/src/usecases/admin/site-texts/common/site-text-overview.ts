import { Injectable } from '@nestjs/common';

import { SiteTextEntriesBuilder, SiteTextEntryState } from './site-text-entries.builder';
import { SiteTextRowsRepository } from './site-text-rows.repository';

/** Every site text as the editor shows it, from the stored rows (the editor, its counters, the dashboard). */
@Injectable()
export class SiteTextOverview {
  constructor(
    private readonly entries: SiteTextEntriesBuilder,
    private readonly rows: SiteTextRowsRepository,
  ) {}

  /** Every site text, in the order of shared/messages/ru.json. */
  async findEntries(): Promise<SiteTextEntryState[]> {
    return this.entries.build(await this.rows.findAll());
  }
}
