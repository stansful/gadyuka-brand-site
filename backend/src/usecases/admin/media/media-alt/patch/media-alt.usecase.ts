import { Injectable } from '@nestjs/common';

import { LocalizedTextValue, TranslationsInput } from '~core/locales/localized-text-value';
import { Usecase } from '~usecases/usecase.interfaces';

import { MediaAltRepository } from './media-alt.repository';
import { MediaAltResponse } from './media-alt.response';

export interface MediaAltCommand {
  readonly id: string;
  readonly alt: TranslationsInput;
}

/** Saves the alt text of a media file (port of updateMediaAlt): trimmed, empty translations dropped. */
@Injectable()
export class MediaAltUsecase implements Usecase<MediaAltCommand, MediaAltResponse> {
  constructor(private readonly repository: MediaAltRepository) {}

  async execute({ id, alt }: MediaAltCommand): Promise<MediaAltResponse> {
    const stored = LocalizedTextValue.normalize(alt);
    await this.repository.updateAlt({ id, alt: stored });
    return MediaAltResponse.of({ id, alt: stored });
  }
}
