/**
 * The star scale of review ratings: SiteSettings.reviewRatingMax (a setting of the admin, CHECK 1..10).
 * A rating is 1 … max; the settings form refuses a scale below a stored rating, and the site shows a
 * stored rating on the CURRENT scale (a row edited by hand still reads safely).
 */
export class ReviewRatingScale {
  /** Hard limits of the scale and of any rating (CHECK constraints of the migration). */
  static readonly LIMIT = { MIN: 1, MAX: 10 } as const;
  /** The scale before the settings are saved for the first time (= the column default). */
  static readonly DEFAULT_MAX = 5;

  private constructor(readonly max: number) {}

  /** The stored scale, or the default when the settings row does not exist yet. */
  static of(storedMax: number | undefined): ReviewRatingScale {
    return new ReviewRatingScale(storedMax ?? ReviewRatingScale.DEFAULT_MAX);
  }

  /** A new rating fits the current scale (the admin's review form). */
  allows(rating: number): boolean {
    return rating <= this.max;
  }

  /** A stored rating as the site shows it: clamped to 1..max; null (no rating) stays null. */
  place(rating: number | null): number | null {
    if (rating === null) {
      return null;
    }
    return Math.min(Math.max(ReviewRatingScale.LIMIT.MIN, rating), this.max);
  }
}
