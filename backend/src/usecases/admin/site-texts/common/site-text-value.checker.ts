import { Injectable } from '@nestjs/common';

import type { MessageRef } from '~shared/contracts/errors';

import { SiteTextsMessageKey } from '~core/constants/site-texts-message-key.enum';
import { SiteHref } from '~core/links/site-href';
import { DEFAULT_LOCALE, Locale } from '~core/locales/locale.enum';
import { SiteTextKind } from '~core/site-texts/site-text-kind.enum';
import { MessageSyntax, MessageValueValidator } from '~module/messages';

import { SiteTextDefinition } from './site-text-definitions';
import { SiteTextIssueMapper } from './site-text-issue.mapper';

/**
 * Why a value cannot be saved as the `locale` text of a site text (port of the frontend's
 * siteTextValueError; undefined = fine):
 * - a required text needs a Russian text (other languages may be empty: they show Russian);
 * - a "link" text must be a site link (SiteHref);
 * - the value must be valid ICU, use only the {arguments} and <tags> of the default (every tag of it)
 *   and format without errors; a "template" text may use them only as plain {name} placeholders and the
 *   default's tags, each once (MessageValueValidator);
 * - it must keep every {argument} of the default of its locale (the code fills each in).
 */
@Injectable()
export class SiteTextValueChecker {
  private static readonly SYNTAX: Readonly<Record<SiteTextKind, MessageSyntax>> = {
    [SiteTextKind.TEXT]: MessageSyntax.ICU,
    [SiteTextKind.RICHTEXT]: MessageSyntax.ICU,
    [SiteTextKind.ICU]: MessageSyntax.ICU,
    [SiteTextKind.TEMPLATE]: MessageSyntax.TEMPLATE,
    [SiteTextKind.LINK]: MessageSyntax.ICU,
  };

  /** Rules of a kind checked before the ICU rules (only links have one). */
  private static readonly KIND_RULES: Readonly<Record<SiteTextKind, (text: string) => MessageRef | undefined>> = {
    [SiteTextKind.TEXT]: () => undefined,
    [SiteTextKind.RICHTEXT]: () => undefined,
    [SiteTextKind.ICU]: () => undefined,
    [SiteTextKind.TEMPLATE]: () => undefined,
    [SiteTextKind.LINK]: text => (SiteHref.isValid(text) ? undefined : { key: SiteTextsMessageKey.ERRORS_LINK }),
  };

  private readonly issues = new SiteTextIssueMapper();

  constructor(private readonly validator: MessageValueValidator) {}

  findError(definition: SiteTextDefinition, locale: Locale, value: string): MessageRef | undefined {
    const text = value.trim();
    if (text === '') {
      return this.findEmptyError(definition, locale);
    }
    return (
      SiteTextValueChecker.KIND_RULES[definition.kind](text) ??
      this.findFormatError(definition, locale, text) ??
      this.findLostArgument(definition, locale, text)
    );
  }

  private findEmptyError(definition: SiteTextDefinition, locale: Locale): MessageRef | undefined {
    const isRequired = locale === DEFAULT_LOCALE && definition.required;
    return isRequired ? { key: SiteTextsMessageKey.ERRORS_REQUIRED } : undefined;
  }

  private findFormatError(definition: SiteTextDefinition, locale: Locale, text: string): MessageRef | undefined {
    const syntax = SiteTextValueChecker.SYNTAX[definition.kind];
    const [issue] = this.validator.validate(definition.key, text, { syntax, locale });
    return issue === undefined ? undefined : this.issues.toMessage(issue, definition.format);
  }

  /**
   * An argument of the default of `locale` the value lost («Оценка {rating} из {max}» cannot become
   * «из 5»). Compared per locale: a default may legitimately use fewer arguments in one language.
   */
  private findLostArgument(definition: SiteTextDefinition, locale: Locale, text: string): MessageRef | undefined {
    const own = this.validator.parseFormat(definition.defaults[locale]);
    const edited = this.validator.parseFormat(text);
    if (!own.ok || !edited.ok) {
      return undefined;
    }
    const lost = own.format.arguments.find(name => !edited.format.arguments.includes(name));
    const token = lost === undefined ? undefined : this.issues.argumentToken(lost);
    return token === undefined ? undefined : { key: SiteTextsMessageKey.ERRORS_MISSING_ARGUMENT, values: { token } };
  }
}
