/** Text for Telegram parse_mode=HTML: only &, <, > need escaping (and " inside attributes). */
export class HtmlEscaper {
  escape(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
