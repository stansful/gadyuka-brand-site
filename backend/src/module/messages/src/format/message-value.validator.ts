import { MessageFormatElement, isTagElement } from '@formatjs/icu-messageformat-parser';

import { LocaleMap } from '~core/locales/locale-map';
import { DEFAULT_LOCALE, Locale } from '~core/locales/locale.enum';

import { MessageCatalog } from '../message-catalog';
import { ArgumentType } from './argument-type.enum';
import { IcuMessageParser, IcuParseResult } from './icu-message.parser';
import { MessageFormat } from './message-format';
import { MessageFormatCollector } from './message-format.collector';
import { MessageIssueCode, MessageValueIssue } from './message-issue';
import { MessageSyntax } from './message-syntax.enum';
import { TemplateRulesChecker } from './template-rules.checker';
import { TrialFormatChecker } from './trial-format.checker';

export interface MessageValueOptions {
  /** TEMPLATE for the keys the client components fill in. Default ICU. */
  readonly syntax?: MessageSyntax;
  /** Language of the value (plural rules, number formats of the trial format). Default ru. */
  readonly locale?: Locale;
}

type NameIssueCode = MessageIssueCode.UNKNOWN_ARGUMENT | MessageIssueCode.UNKNOWN_TAG | MessageIssueCode.MISSING_TAG;

interface ParsedValue {
  readonly key: string;
  readonly value: string;
  readonly elements: MessageFormatElement[];
}

/**
 * ICU checks of admin-edited site messages (port of the frontend's src/i18n/message-format.ts).
 * A value must render the way the site reads its key, and may only use the arguments and tags of
 * its default: plain copy has none; full ICU is trial-formatted; simple templates follow
 * TemplateRulesChecker. A blank value is fine here (whether a key may be empty is not a format rule).
 */
export class MessageValueValidator {
  private readonly parser = new IcuMessageParser();
  private readonly collector = new MessageFormatCollector();
  private readonly templateRules = new TemplateRulesChecker(this.parser);
  private readonly trialFormat = new TrialFormatChecker(this.parser, this.collector);

  constructor(private readonly catalog: MessageCatalog) {}

  hasSyntax(value: string): boolean {
    return this.parser.hasSyntax(value);
  }

  /** Arguments and tags of `value` (or the parser's error kind). */
  parseFormat(value: string): { ok: true; format: MessageFormat } | { ok: false; error: string } {
    const parsed = this.parser.parse(value);
    return parsed.ok ? { ok: true, format: this.collector.formatOf(parsed.elements) } : parsed;
  }

  /** Arguments and tags of a key's defaults, merged over every locale (hints in the editor). */
  defaultFormat(key: string): MessageFormat {
    return this.collector.formatOf(this.defaultElements(key).flat());
  }

  /** Problems of an admin-entered value for `key` ([] = fine). */
  validate(key: string, value: string, options: MessageValueOptions = {}): MessageValueIssue[] {
    if (value.trim() === '') {
      return [];
    }
    const parsed = this.parser.parse(value);
    if (!parsed.ok) {
      return [{ code: MessageIssueCode.SYNTAX, error: parsed.error }];
    }
    return this.validateParsed({ key, value, elements: parsed.elements }, options);
  }

  /** The issues of the first failing check: names, then template rules, then the trial format. */
  private validateParsed(parsed: ParsedValue, options: MessageValueOptions): MessageValueIssue[] {
    return this.firstIssues([
      () => this.nameIssues(this.collector.formatOf(parsed.elements), this.defaultFormat(parsed.key)),
      () => this.templateIssues(parsed, options.syntax ?? MessageSyntax.ICU),
      () => this.trialFormatIssues(parsed, options.locale ?? DEFAULT_LOCALE),
    ]);
  }

  private firstIssues(checks: ReadonlyArray<() => MessageValueIssue[]>): MessageValueIssue[] {
    for (const check of checks) {
      const issues = check();
      if (issues.length > 0) {
        return issues;
      }
    }
    return [];
  }

  private nameIssues(format: MessageFormat, allowed: MessageFormat): MessageValueIssue[] {
    return [
      ...this.namesOutside(format.arguments, allowed.arguments, MessageIssueCode.UNKNOWN_ARGUMENT),
      ...this.namesOutside(format.tags, allowed.tags, MessageIssueCode.UNKNOWN_TAG),
      ...this.namesOutside(allowed.tags, format.tags, MessageIssueCode.MISSING_TAG),
    ];
  }

  private namesOutside(names: readonly string[], allowed: readonly string[], code: NameIssueCode): MessageValueIssue[] {
    return names.filter(name => !allowed.includes(name)).map(name => ({ code, name }));
  }

  private trialFormatIssues(parsed: ParsedValue, locale: Locale): MessageValueIssue[] {
    return this.trialFormat.check({ ...parsed, locale, argumentTypes: this.argumentTypes(parsed.key) });
  }

  private templateIssues(parsed: ParsedValue, syntax: MessageSyntax): MessageValueIssue[] {
    const checks: Record<MessageSyntax, () => MessageValueIssue[]> = {
      [MessageSyntax.ICU]: () => [],
      [MessageSyntax.TEMPLATE]: () =>
        this.templateRules.check({ ...parsed, defaultTagSources: this.defaultTagSources(parsed.key) }),
    };
    return checks[syntax]();
  }

  private argumentTypes(key: string): Map<string, ArgumentType> {
    const types = new Map<string, ArgumentType>();
    this.defaultElements(key).forEach(elements => this.collector.argumentTypes(elements, types));
    return types;
  }

  /** "lang" → the tag elements of the defaults as written there ("<lang>{language}</lang>"). */
  private defaultTagSources(key: string): Map<string, string[]> {
    const sources = new Map<string, string[]>();
    for (const locale of LocaleMap.LOCALES) {
      const value = this.catalog.siteDefault(key, locale);
      this.collectTagSources(value, this.elementsOf(this.parser.parse(value)), sources);
    }
    return sources;
  }

  private collectTagSources(
    value: string,
    elements: readonly MessageFormatElement[],
    sources: Map<string, string[]>,
  ): void {
    for (const element of elements.filter(isTagElement)) {
      const known = sources.get(element.value) ?? [];
      const source = this.parser.sourceOf(value, element);
      sources.set(element.value, known.includes(source) ? known : [...known, source]);
      this.collectTagSources(value, element.children, sources);
    }
  }

  /** Parsed defaults of a key, one per locale (the defaults are valid ICU — catalog test). */
  private defaultElements(key: string): MessageFormatElement[][] {
    return LocaleMap.LOCALES.map(locale => this.elementsOf(this.parser.parse(this.catalog.siteDefault(key, locale))));
  }

  private elementsOf(parsed: IcuParseResult): MessageFormatElement[] {
    return parsed.ok ? parsed.elements : [];
  }
}
