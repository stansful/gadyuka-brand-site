import type { MessageRef } from '~shared/contracts/errors';

import { SiteTextsMessageKey } from '~core/constants/site-texts-message-key.enum';
import { ValidationFailedException } from '~exception';

/**
 * Field errors of a «Тексты сайта» save: "<message key>.<locale>" for a text, "<message key>" for an
 * unknown text, "<image key>" for a landing image — answered as 400 validation with the form-level
 * message under "" (shared/contracts/site-texts.ts).
 */
export class SiteTextFieldErrors {
  private readonly fields: Record<string, MessageRef> = {};

  add(path: string, message: MessageRef): void {
    this.fields[path] = message;
  }

  hasErrors(): boolean {
    return Object.keys(this.fields).length > 0;
  }

  toException(formMessage: SiteTextsMessageKey): ValidationFailedException {
    return new ValidationFailedException({ '': { key: formMessage }, ...this.fields });
  }
}
