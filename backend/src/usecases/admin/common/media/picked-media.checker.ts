import { Injectable } from '@nestjs/common';

import { MissingMediaException } from './missing-media.exception';
import { PickedMediaRepository } from './picked-media.repository';

/**
 * Checks the media files an admin form picked before the row is written: a deleted file is reported as
 * admin.errors.missingMedia (MissingMediaException) instead of a foreign key error.
 */
@Injectable()
export class PickedMediaChecker {
  constructor(private readonly repository: PickedMediaRepository) {}

  /** `ids`: the picked files (null = none picked). */
  async assertExist(ids: ReadonlyArray<string | null>): Promise<void> {
    const wanted = [...new Set(ids.filter((id): id is string => id !== null))];
    if (wanted.length === 0) {
      return;
    }
    if ((await this.repository.countExisting(wanted)) !== wanted.length) {
      throw new MissingMediaException();
    }
  }
}
