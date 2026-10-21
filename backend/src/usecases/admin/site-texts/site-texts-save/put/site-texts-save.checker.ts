import { Injectable } from '@nestjs/common';

import { SiteTextsMessageKey } from '~core/constants/site-texts-message-key.enum';
import { LocaleMap } from '~core/locales/locale-map';
import { Locale } from '~core/locales/locale.enum';
import { SiteImageChange } from '~core/site-texts/site-image-save.planner';
import { SiteTextRegistry } from '~core/site-texts/site-text-registry';
import { SiteTextChange, SiteTextSavePlanner } from '~core/site-texts/site-text-save.planner';
import { SiteTextDefinition, SiteTextDefinitions } from '~usecases/admin/site-texts/common/site-text-definitions';
import { SiteTextValueChecker } from '~usecases/admin/site-texts/common/site-text-value.checker';

import { SiteTextFieldErrors } from './site-text-field-errors';
import { SiteTextsSaveRepository } from './site-texts-save.repository';

/** A text of the save: the submitted languages, each with the stored text the edit started from. */
export interface SiteTextEntryChange {
  readonly key: string;
  readonly values: Readonly<Partial<Record<Locale, { readonly value: string; readonly base: string }>>>;
}

/** What the checks of a save read. */
export interface SiteTextsSaveInput {
  readonly entries: readonly SiteTextEntryChange[];
  readonly images: readonly SiteImageChange[];
}

/**
 * The checks of a «Тексты сайта» save after the shape of the request (port of the frontend action):
 * 1. every key is a current site text, every image key a landing image, and every EDITED value can be
 *    saved (SiteTextValueChecker) — a resent stored text (a language without a row) is never written as
 *    sent, so it is not checked;
 * 2. every picked media still exists (deleted in the media library meanwhile: a stale picker).
 */
@Injectable()
export class SiteTextsSaveChecker {
  constructor(
    private readonly definitions: SiteTextDefinitions,
    private readonly values: SiteTextValueChecker,
    private readonly registry: SiteTextRegistry,
    private readonly repository: SiteTextsSaveRepository,
  ) {}

  /** Throws 400 validation: "" = admin.siteTexts.errors.fixErrors, one error per field. */
  assertValid(input: SiteTextsSaveInput): void {
    const errors = new SiteTextFieldErrors();
    input.entries.forEach(entry => this.checkEntry(entry, errors));
    input.images
      .filter(image => !this.registry.isImageKey(image.key))
      .forEach(image => errors.add(image.key, { key: SiteTextsMessageKey.ERRORS_UNKNOWN_IMAGE }));
    if (errors.hasErrors()) {
      throw errors.toException(SiteTextsMessageKey.ERRORS_FIX_ERRORS);
    }
  }

  /** Throws 400 validation: "" and every image with a deleted media = admin.errors.missingMedia. */
  async assertMediaExist(images: readonly SiteImageChange[]): Promise<void> {
    const ids = [...new Set(images.flatMap(image => (image.mediaId === null ? [] : [image.mediaId])))];
    const found = new Set(ids.length === 0 ? [] : await this.repository.findMediaIds(ids));
    const errors = new SiteTextFieldErrors();
    images
      .filter(image => image.mediaId !== null && !found.has(image.mediaId))
      .forEach(image => errors.add(image.key, { key: SiteTextsMessageKey.ERRORS_MISSING_MEDIA }));
    if (errors.hasErrors()) {
      throw errors.toException(SiteTextsMessageKey.ERRORS_MISSING_MEDIA);
    }
  }

  /** The submitted languages of every text, in request order. */
  changesOf(input: SiteTextsSaveInput): SiteTextChange[] {
    return input.entries.flatMap(entry => this.changesOfEntry(entry));
  }

  private checkEntry(entry: SiteTextEntryChange, errors: SiteTextFieldErrors): void {
    const definition = this.definitions.find(entry.key);
    if (definition === undefined) {
      errors.add(entry.key, { key: SiteTextsMessageKey.ERRORS_UNKNOWN_KEY });
      return;
    }
    const edits = this.changesOfEntry(entry).filter(change => SiteTextSavePlanner.isEdit(change));
    edits.forEach(change => this.checkValue(definition, change, errors));
  }

  private checkValue(definition: SiteTextDefinition, change: SiteTextChange, errors: SiteTextFieldErrors): void {
    const error = this.values.findError(definition, change.locale, change.value);
    if (error !== undefined) {
      errors.add(`${change.key}.${change.locale}`, error);
    }
  }

  private changesOfEntry(entry: SiteTextEntryChange): SiteTextChange[] {
    return LocaleMap.LOCALES.flatMap(locale => {
      const change = entry.values[locale];
      return change === undefined ? [] : [{ key: entry.key, locale, value: change.value, base: change.base }];
    });
  }
}
