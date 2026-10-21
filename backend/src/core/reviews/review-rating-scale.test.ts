import { ok, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { ReviewRatingScale } from './review-rating-scale';

describe('ReviewRatingScale', () => {
  it('defaults to 5 stars before the settings are saved (the column default)', () => {
    strictEqual(ReviewRatingScale.DEFAULT_MAX, 5);
    strictEqual(ReviewRatingScale.of(undefined).max, 5);
    strictEqual(ReviewRatingScale.of(7).max, 7);
  });

  it('allows new ratings up to the scale (the admin form)', () => {
    const scale = ReviewRatingScale.of(5);
    ok(scale.allows(1));
    ok(scale.allows(5));
    ok(!scale.allows(6));
  });

  it('shows stored ratings on the current scale (the site)', () => {
    strictEqual(ReviewRatingScale.of(5).place(null), null);
    strictEqual(ReviewRatingScale.of(5).place(4), 4);
    strictEqual(ReviewRatingScale.of(5).place(8), 5);
    strictEqual(ReviewRatingScale.of(10).place(8), 8);
    strictEqual(ReviewRatingScale.of(5).place(0), 1);
  });
});
