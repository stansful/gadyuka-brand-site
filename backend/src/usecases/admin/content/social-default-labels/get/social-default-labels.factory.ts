import type { LocalizedText } from '~shared/contracts/common';

import { Locale } from '~core/locales/locale.enum';
import { SocialType } from '~core/socials/social-type';
import { FlatMessages } from '~module/messages';

/**
 * What the site shows for a social link without its own label: the site message `social.<TYPE>` of
 * each locale (as the site resolves it: admin edits over the shared/messages defaults).
 */
export class SocialDefaultLabelsFactory {
  private static readonly KEY_PREFIX = 'social.';

  static build(messagesByLocale: ReadonlyMap<Locale, FlatMessages>): Record<SocialType, LocalizedText> {
    const entries = Object.values(SocialType).map(type => [
      type,
      SocialDefaultLabelsFactory.labelOf(type, messagesByLocale),
    ]);
    // Every SocialType got an entry above.
    return Object.fromEntries(entries) as Record<SocialType, LocalizedText>;
  }

  private static labelOf(type: SocialType, messagesByLocale: ReadonlyMap<Locale, FlatMessages>): LocalizedText {
    const key = `${SocialDefaultLabelsFactory.KEY_PREFIX}${type}`;
    const entries = [...messagesByLocale].flatMap(([locale, messages]) =>
      messages[key] === undefined ? [] : [[locale, messages[key]] as const],
    );
    return Object.fromEntries(entries);
  }
}
