import { ApiProperty } from '@nestjs/swagger';

import type { LocalizedText } from '~shared/contracts/common';
import type { AdminSocialDefaultLabelsResponse, SocialType } from '~shared/contracts/content-entities';

/** GET /admin/social-links/default-labels: the default name of every social type, per locale. */
export class SocialDefaultLabelsResponse implements AdminSocialDefaultLabelsResponse {
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'object', additionalProperties: { type: 'string' } },
    example: { TELEGRAM: { ru: 'Telegram', en: 'Telegram' }, WEBSITE: { ru: 'Сайт', en: 'Website' } },
  })
  labels: Record<SocialType, LocalizedText>;

  static of(labels: Record<SocialType, LocalizedText>): SocialDefaultLabelsResponse {
    return Object.assign(new SocialDefaultLabelsResponse(), { labels });
  }
}
