/** A multi-line text as a list (product details: fabric, fit, print … — one item per line). */
export class TextLines {
  private static readonly LINE_BREAK = /\r?\n/;

  /** Trimmed, non-empty lines of `text`. */
  static split(text: string): string[] {
    return text
      .split(TextLines.LINE_BREAK)
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }
}
