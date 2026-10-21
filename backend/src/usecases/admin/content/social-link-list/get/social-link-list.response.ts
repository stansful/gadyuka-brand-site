import { ApiProperty } from '@nestjs/swagger';

import type { AdminSocialLinkListResponse } from '~shared/contracts/content-entities';

import { SocialLinkRecord } from '~usecases/admin/content/common/socials/social-link.records';

import { SocialLinkListItemResponse } from './social-link-list-item.response';

/** GET /admin/social-links: every social link in the manual order. */
export class SocialLinkListResponse implements AdminSocialLinkListResponse {
  @ApiProperty({ type: [SocialLinkListItemResponse] })
  items: SocialLinkListItemResponse[];

  static of(records: readonly SocialLinkRecord[]): SocialLinkListResponse {
    return Object.assign(new SocialLinkListResponse(), {
      items: records.map(record => SocialLinkListItemResponse.of(record)),
    });
  }
}
