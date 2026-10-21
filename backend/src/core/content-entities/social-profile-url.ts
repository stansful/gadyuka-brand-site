/** Links of the social / messenger profiles (SocialLink.url). */
export class SocialProfileUrl {
  private static readonly TRAILING_SLASHES = /\/+$/;

  /**
   * A link without a profile ("https://t.me/" — the seed placeholder): its path is empty. The admin
   * list flags it, the site's search data leaves it out. An unparseable link is not "bare".
   */
  static isBare(url: string): boolean {
    const parsed = URL.parse(url);
    return parsed !== null && parsed.pathname.replace(SocialProfileUrl.TRAILING_SLASHES, '') === '';
  }
}
