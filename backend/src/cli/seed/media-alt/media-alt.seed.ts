import { Injectable, Logger } from '@nestjs/common';

import { LocalizedTextValue } from '~core/locales/localized-text-value';

import { DemoEntityCatalog } from '../data/demo-entity.catalog';
import { SeedMode } from '../run/seed-mode.enum';
import { SeedOptions } from '../run/seed-options';
import { SeedRun, SeededMedia } from '../run/seed-run';
import { SeedStep } from '../seed-step.interface';
import { MediaAltSeedRepository } from './media-alt-seed.repository';

/**
 * Alt texts of the seed images of this run (shared/messages/content/<locale>.json `mediaAlt.<key>`). The
 * media step never writes Media.alt; this sets it where it is still empty, so an alt text edited in the
 * admin survives a re-seed. SEED_OVERWRITE=1 resets it.
 */
@Injectable()
export class MediaAltSeed implements SeedStep {
  /** Whether a row's stored alt text is replaced by the seed copy. */
  private static readonly IS_DUE: Readonly<Record<SeedMode, (storedAlt: unknown) => boolean>> = {
    [SeedMode.KEEP_EDITS]: storedAlt => LocalizedTextValue.from(storedAlt).hasNoTranslation(),
    [SeedMode.OVERWRITE]: () => true,
  };

  private readonly logger = new Logger(MediaAltSeed.name);

  constructor(
    private readonly options: SeedOptions,
    private readonly seedRun: SeedRun,
    private readonly catalog: DemoEntityCatalog,
    private readonly repository: MediaAltSeedRepository,
  ) {}

  async run(): Promise<void> {
    const seeded = this.seedRun.seededMedia();
    const rows = await this.repository.findAlts(seeded.map(media => media.mediaId));
    const altById = new Map(rows.map(row => [row.id, row.alt]));
    const isDue = MediaAltSeed.IS_DUE[this.options.mode()];
    const due = seeded.filter(({ mediaId }) => altById.has(mediaId) && isDue(altById.get(mediaId)));
    await this.writeAlts(due);
    this.logger.log('MediaAltSeed : alt texts', { set: due.length, of: seeded.length, mode: this.options.mode() });
  }

  private async writeAlts(due: readonly SeededMedia[]): Promise<void> {
    for (const { key, mediaId } of due) {
      await this.repository.updateAlt(mediaId, this.catalog.mediaAlt(key));
    }
  }
}
