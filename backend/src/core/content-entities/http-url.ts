/**
 * http(s) links to other sites (partners, social profiles) — the rules of zod's
 * z.url({ protocol: /^https?$/ }) the admin used before: the trimmed value starts with "http://" or
 * "https://" (any case), the URL parser accepts it and its protocol is http or https. The stored
 * value is the trimmed input without ASCII tabs and line breaks (which the URL parser ignores).
 */
export class HttpUrl {
  private static readonly SCHEME_PREFIX = /^https?:\/\//i;
  private static readonly PROTOCOL = /^https?:$/;
  private static readonly TAB_OR_LINE_BREAK = /[\t\n\r]/g;

  static isValid(value: string): boolean {
    const trimmed = value.trim();
    if (!HttpUrl.SCHEME_PREFIX.test(trimmed)) {
      return false;
    }
    const url = URL.parse(trimmed);
    return url !== null && HttpUrl.PROTOCOL.test(url.protocol);
  }

  static normalize(value: string): string {
    return value.trim().replace(HttpUrl.TAB_OR_LINE_BREAK, '');
  }
}
