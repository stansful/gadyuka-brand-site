import type { AdminSocialLinkInput } from '~shared/contracts/content-entities';

import { HttpUrl } from '~core/content-entities/http-url';
import { LocalizedTextValue } from '~core/locales/localized-text-value';

import { SocialLinkFields } from './social-link.records';

/** A validated social link form → what is stored (the link and the label normalized; an empty label = {}). */
export class SocialLinkFieldsFactory {
  static fromInput(input: AdminSocialLinkInput): SocialLinkFields {
    return {
      type: input.type,
      url: HttpUrl.normalize(input.url),
      label: LocalizedTextValue.normalize(input.label),
      published: input.published,
    };
  }
}
