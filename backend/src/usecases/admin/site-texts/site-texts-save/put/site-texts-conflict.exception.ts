import { ApiErrorCode } from '~core/constants/api-error-code.enum';
import { SiteTextsMessageKey } from '~core/constants/site-texts-message-key.enum';
import { SiteTextConflict } from '~core/site-texts/site-text-save.planner';
import { DomainErrorDetails, DomainErrorKind, DomainException } from '~exception';

/**
 * Nothing was saved: texts or landing images of the save were changed in another tab or session since
 * the editor loaded them. `details` (SiteTextsConflictDetails): "<message key>.<locale>" → the text
 * stored now, "<image key>" → true — the admin names them and quotes the stored texts.
 */
export class SiteTextsConflictException extends DomainException {
  constructor(texts: readonly SiteTextConflict[], images: readonly string[]) {
    super({
      kind: DomainErrorKind.CONFLICT,
      code: ApiErrorCode.CONFLICT,
      messageKey: SiteTextsMessageKey.ERRORS_CONFLICT,
      details: SiteTextsConflictException.detailsOf(texts, images),
    });
  }

  private static detailsOf(texts: readonly SiteTextConflict[], images: readonly string[]): DomainErrorDetails {
    return Object.fromEntries([
      ...texts.map(text => [`${text.key}.${text.locale}`, text.current] as const),
      ...images.map(key => [key, true] as const),
    ]);
  }
}
