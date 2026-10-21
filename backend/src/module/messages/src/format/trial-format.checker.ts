import { MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import { FormatXMLElementFn, IntlMessageFormat, PrimitiveType } from 'intl-messageformat';

import { LOCALE_TAGS, Locale } from '~core/locales/locale.enum';

import { ArgumentType } from './argument-type.enum';
import { IcuMessageParser } from './icu-message.parser';
import { MessageFormatCollector } from './message-format.collector';
import { MessageIssueCode, MessageValueIssue } from './message-issue';

type SampleValue = PrimitiveType | FormatXMLElementFn<string>;

export interface TrialFormatInput {
  readonly value: string;
  readonly elements: MessageFormatElement[];
  readonly locale: Locale;
  /** How the code passes each argument of the key (from its defaults) */
  readonly argumentTypes: ReadonlyMap<string, ArgumentType>;
}

/**
 * Formats a value as the site would, with sample arguments of the right type: each number / date
 * argument on its own (a plural / select branch the samples do not select is checked too), then
 * the whole message. A format that throws here would make the site show the key instead.
 */
export class TrialFormatChecker {
  private static readonly SAMPLE_NUMBER = 2;
  private static readonly SAMPLE_DATE = new Date(Date.UTC(2026, 0, 31, 12));
  private static readonly SAMPLE_TEXT = 'x';

  constructor(
    private readonly parser: IcuMessageParser,
    private readonly collector: MessageFormatCollector,
  ) {}

  check(input: TrialFormatInput): MessageValueIssue[] {
    const samples = this.sampleValues(input);
    for (const element of this.collector.formattedElements(input.elements)) {
      const error = this.findFormatError([element], input.locale, samples);
      if (error !== undefined) {
        return [{ code: MessageIssueCode.FORMAT, token: this.parser.sourceOf(input.value, element), error }];
      }
    }
    const error = this.findFormatError(input.elements, input.locale, samples);
    return error === undefined ? [] : [{ code: MessageIssueCode.FORMAT, token: input.value, error }];
  }

  private sampleValues(input: TrialFormatInput): Record<string, SampleValue> {
    const format = this.collector.formatOf(input.elements);
    const samples: Record<string, SampleValue> = {};
    for (const name of format.arguments) {
      samples[name] = this.sampleOf(input.argumentTypes.get(name) ?? ArgumentType.TEXT);
    }
    for (const name of format.tags) {
      samples[name] = (chunks: ReadonlyArray<string>) => chunks.join('');
    }
    return samples;
  }

  private sampleOf(type: ArgumentType): SampleValue {
    const samples: Record<ArgumentType, SampleValue> = {
      [ArgumentType.NUMBER]: TrialFormatChecker.SAMPLE_NUMBER,
      [ArgumentType.DATE]: TrialFormatChecker.SAMPLE_DATE,
      [ArgumentType.TEXT]: TrialFormatChecker.SAMPLE_TEXT,
    };
    return samples[type];
  }

  private findFormatError(
    elements: MessageFormatElement[],
    locale: Locale,
    samples: Record<string, SampleValue>,
  ): string | undefined {
    try {
      new IntlMessageFormat(elements, LOCALE_TAGS[locale]).format<string>(samples);
      return undefined;
    } catch (error: unknown) {
      return error instanceof Error ? error.message : String(error);
    }
  }
}
