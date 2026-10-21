/** The message of a lead as the admin list shows it: on one line, cut to 140 characters (+ «…»). */
export class LeadPreview {
  private static readonly MAX_LENGTH = 140;
  private static readonly ELLIPSIS = '…';

  static of(message: string): string {
    const line = message.replace(/\s+/g, ' ').trim();
    return line.length > LeadPreview.MAX_LENGTH
      ? `${line.slice(0, LeadPreview.MAX_LENGTH)}${LeadPreview.ELLIPSIS}`
      : line;
  }
}
