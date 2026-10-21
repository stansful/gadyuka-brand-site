import { Injectable, Logger } from '@nestjs/common';

import { SiteImageChange, SiteImageSavePlanner } from '~core/site-texts/site-image-save.planner';
import { SiteTextChange, SiteTextSavePlanner } from '~core/site-texts/site-text-save.planner';
import { SiteMessagesService } from '~module/site-messages';
import { SiteTextsSession } from '~usecases/admin/site-texts/common/site-texts.session';
import { SiteTextsStore } from '~usecases/admin/site-texts/common/site-texts.store';
import { Usecase } from '~usecases/usecase.interfaces';

import { SiteTextsConflictException } from './site-texts-conflict.exception';
import { SiteTextEntryChange, SiteTextsSaveChecker } from './site-texts-save.checker';
import { SavedSiteTexts, SiteTextsSaveResponse } from './site-texts-save.response';

export interface SiteTextsSaveCommand {
  readonly entries: readonly SiteTextEntryChange[];
  readonly images: readonly SiteImageChange[];
}

interface CheckedSave {
  readonly changes: readonly SiteTextChange[];
  readonly images: readonly SiteImageChange[];
}

/**
 * Saves the texts (and landing images) the editor changed. Checks, in order: the content of every edited
 * value (SiteTextsSaveChecker), the picked media exist; then, inside a transaction under the «Тексты
 * сайта» lock, that every edit still starts from what is stored — a text or image changed in another
 * tab or session meanwhile refuses the whole save (409) instead of being overwritten. Only what changes
 * is written; the site's message cache is dropped after a write.
 */
@Injectable()
export class SiteTextsSaveUsecase implements Usecase<SiteTextsSaveCommand, SiteTextsSaveResponse> {
  private readonly logger = new Logger(SiteTextsSaveUsecase.name);

  constructor(
    private readonly checker: SiteTextsSaveChecker,
    private readonly store: SiteTextsStore,
    private readonly texts: SiteTextSavePlanner,
    private readonly pictures: SiteImageSavePlanner,
    private readonly siteMessages: SiteMessagesService,
  ) {}

  async execute(command: SiteTextsSaveCommand): Promise<SiteTextsSaveResponse> {
    this.checker.assertValid(command);
    await this.checker.assertMediaExist(command.images);
    const save: CheckedSave = { changes: this.checker.changesOf(command), images: command.images };
    if (save.changes.length === 0 && save.images.length === 0) {
      return SiteTextsSaveResponse.of({ saved: 0, values: {} });
    }
    const saved = await this.store.runLocked(session => this.saveLocked(session, save));
    this.reportSaved(saved);
    return SiteTextsSaveResponse.of(saved);
  }

  private async saveLocked(session: SiteTextsSession, save: CheckedSave): Promise<SavedSiteTexts> {
    const rows = await session.findMessages(save.changes.map(change => change.key));
    const imageRows = await session.findImages(save.images.map(image => image.key));
    const texts = this.texts.plan(save.changes, rows, new Date());
    const images = this.pictures.plan(save.images, imageRows);
    if (texts.conflicts.length > 0 || images.conflicts.length > 0) {
      throw new SiteTextsConflictException(texts.conflicts, images.conflicts);
    }
    await session.saveMessages(texts.writes);
    await session.saveImages(images.writes);
    return { saved: texts.writes.length + images.writes.length, values: texts.stored };
  }

  private reportSaved(saved: SavedSiteTexts): void {
    if (saved.saved === 0) {
      return;
    }
    this.siteMessages.invalidate();
    this.logger.log('SiteTextsSaveUsecase : texts saved', { rows: saved.saved });
  }
}
