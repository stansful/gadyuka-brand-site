/**
 * The «Тексты сайта» search query: trimmed, inner whitespace collapsed, capped at MAX_LENGTH ("" = no
 * search). Matching is case-insensitive and «ё» = «е» (any diaeresis is dropped: NFD + U+0308).
 */
export class SiteTextQuery {
  /** Max length of the query (longer input is cut, as the admin's search field allows). */
  static readonly MAX_LENGTH = 100;

  private static readonly FOLD_LOCALE = 'ru-RU';
  private static readonly DIAERESIS = /̈/g;
  private static readonly WHITESPACE = /\s+/g;

  private constructor(
    private readonly text: string,
    private readonly needle: string,
  ) {}

  static parse(value: string | undefined): SiteTextQuery {
    const text = (value ?? '').trim().replace(SiteTextQuery.WHITESPACE, ' ').slice(0, SiteTextQuery.MAX_LENGTH);
    return new SiteTextQuery(text, SiteTextQuery.fold(text));
  }

  /** Lower case, «ё» = «е», collapsed spaces. */
  private static fold(value: string): string {
    return value
      .toLocaleLowerCase(SiteTextQuery.FOLD_LOCALE)
      .normalize('NFD')
      .replace(SiteTextQuery.DIAERESIS, '')
      .normalize('NFC')
      .replace(SiteTextQuery.WHITESPACE, ' ');
  }

  isEmpty(): boolean {
    return this.text === '';
  }

  /** True when the query occurs in any of the texts (an empty query matches everything). */
  matchesAny(texts: readonly string[]): boolean {
    return texts.some(text => SiteTextQuery.fold(text).includes(this.needle));
  }

  toString(): string {
    return this.text;
  }
}
