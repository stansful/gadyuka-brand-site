import { Injectable, Logger } from '@nestjs/common';

import { SiteTextSavePlanner } from '~core/site-texts/site-text-save.planner';
import { SiteMessagesService } from '~module/site-messages';
import { SiteTextDefinitions } from '~usecases/admin/site-texts/common/site-text-definitions';
import { SiteTextsStore } from '~usecases/admin/site-texts/common/site-texts.store';
import { Usecase } from '~usecases/usecase.interfaces';

import { SiteTextNotFoundException } from './site-text-not-found.exception';
import { SiteTextsResetResponse } from './site-texts-reset.response';

export interface SiteTextsResetCommand {
  readonly key: string;
}

/**
 * «Вернуть по умолчанию»: every locale of the text gets its shared/messages/<locale>.json value back,
 * with editedAt = null (the seed keeps such rows in sync with newer defaults). Written under the
 * «Тексты сайта» lock, like a save.
 */
@Injectable()
export class SiteTextsResetUsecase implements Usecase<SiteTextsResetCommand, SiteTextsResetResponse> {
  private readonly logger = new Logger(SiteTextsResetUsecase.name);

  constructor(
    private readonly definitions: SiteTextDefinitions,
    private readonly store: SiteTextsStore,
    private readonly planner: SiteTextSavePlanner,
    private readonly siteMessages: SiteMessagesService,
  ) {}

  async execute({ key }: SiteTextsResetCommand): Promise<SiteTextsResetResponse> {
    const definition = this.definitions.find(key);
    if (definition === undefined) {
      throw new SiteTextNotFoundException();
    }
    const writes = this.planner.resetWrites(key);
    await this.store.runLocked(session => session.saveMessages(writes));
    this.siteMessages.invalidate();
    this.logger.log('SiteTextsResetUsecase : text reset to the default', { key });
    return SiteTextsResetResponse.of(key, definition.defaults);
  }
}
