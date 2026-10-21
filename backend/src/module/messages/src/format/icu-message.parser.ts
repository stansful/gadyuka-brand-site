import { MessageFormatElement, parse } from '@formatjs/icu-messageformat-parser';

export type IcuParseResult =
  | { readonly ok: true; readonly elements: MessageFormatElement[] }
  | { readonly ok: false; readonly error: string };

/**
 * ICU MessageFormat parsing with source locations (the template rules compare an element with
 * its source text). Parser: @formatjs/icu-messageformat-parser — what next-intl itself uses.
 */
export class IcuMessageParser {
  private static readonly SYNTAX_PATTERN = /[{}]|<\/?[A-Za-z][\w-]*>/;

  /** Cheap check: does the text contain ICU syntax ({argument}, plural, <tag>)? No parsing. */
  hasSyntax(value: string): boolean {
    return IcuMessageParser.SYNTAX_PATTERN.test(value);
  }

  /** `error` is the parser's error kind ("EXPECT_ARGUMENT_CLOSING_BRACE", "UNCLOSED_TAG", …). */
  parse(value: string): IcuParseResult {
    try {
      return { ok: true, elements: parse(value, { captureLocation: true }) };
    } catch (error: unknown) {
      return { ok: false, error: error instanceof Error ? error.message : 'INVALID_MESSAGE' };
    }
  }

  /** The source text of an element parsed from `value`. */
  sourceOf(value: string, element: MessageFormatElement): string {
    const location = element.location;
    return location ? value.slice(location.start.offset, location.end.offset) : '';
  }
}
