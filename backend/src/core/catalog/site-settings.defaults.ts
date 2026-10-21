import type { LocalizedText } from '~shared/contracts/common';

import { ReviewRatingScale } from '~core/reviews/review-rating-scale';

/** The site settings before the first save (= the column defaults of site_settings). */
export const SITE_SETTINGS_DEFAULTS: {
  readonly phone: string;
  readonly email: string;
  readonly address: LocalizedText;
  readonly reviewRatingMax: number;
  readonly seoTitle: LocalizedText;
  readonly seoDescription: LocalizedText;
} = {
  phone: '',
  email: '',
  address: {},
  reviewRatingMax: ReviewRatingScale.DEFAULT_MAX,
  seoTitle: {},
  seoDescription: {},
};
