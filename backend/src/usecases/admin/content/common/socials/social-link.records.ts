import type { LocalizedText } from '~shared/contracts/common';

import { SocialType } from '~core/socials/social-type';

/** What a social link stores (create / update; the order is set on create only). */
export interface SocialLinkFields {
  readonly type: SocialType;
  readonly url: string;
  /** Empty = the site's default name of the type (message `social.<TYPE>`) */
  readonly label: LocalizedText;
  readonly published: boolean;
}

/** A social link (list rows and the edit form). */
export interface SocialLinkRecord extends SocialLinkFields {
  readonly id: string;
}
