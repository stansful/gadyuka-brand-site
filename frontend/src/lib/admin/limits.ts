/**
 * Limits of the admin forms that the client checks or offers before sending — ISOMORPHIC and
 * dependency-free. The backend enforces the same values (backend/src/core/catalog: PRICE_MAX,
 * ReviewRatingScale.LIMIT) and answers its own validation errors.
 */

/** Upper bound of a product price, ₽ (the product form checks it before sending too). */
export const PRICE_MAX = 100_000_000;

/** Hard limits of the review star scale (SiteSettings.reviewRatingMax, CHECK 1..10). */
export const REVIEW_RATING_LIMIT = { min: 1, max: 10 } as const;
