/**
 * Keys of shared/messages/admin/ru.json the admin catalog answers with (slice S4a: collections,
 * products, reviews, site settings). General keys (admin.validation.invalid, tooLong, idInvalid …)
 * are AdminMessageKey. src/test/message-keys.test.ts checks that every key exists.
 */
export enum CatalogMessageKey {
  VALIDATION_ID_REQUIRED = 'admin.validation.idRequired',
  VALIDATION_SLUG_REQUIRED = 'admin.validation.slugRequired',
  VALIDATION_SLUG_FORMAT = 'admin.validation.slugFormat',
  VALIDATION_REQUIRED_TEXT = 'admin.validation.requiredText',
  VALIDATION_PRICE_INTEGER = 'admin.validation.priceInteger',
  VALIDATION_PRICE_NEGATIVE = 'admin.validation.priceNegative',
  VALIDATION_PRICE_TOO_HIGH = 'admin.validation.priceTooHigh',
  VALIDATION_PHOTOS_TOO_MANY = 'admin.validation.photosTooMany',
  VALIDATION_PHOTOS_DUPLICATE = 'admin.validation.photosDuplicate',
  VALIDATION_AUTHOR_REQUIRED = 'admin.validation.authorRequired',
  VALIDATION_RATING_INTEGER = 'admin.validation.ratingInteger',
  VALIDATION_RATING_TOO_LOW = 'admin.validation.ratingTooLow',
  VALIDATION_RATING_TOO_HIGH = 'admin.validation.ratingTooHigh',
  VALIDATION_PHONE_FORMAT = 'admin.validation.phoneFormat',
  VALIDATION_EMAIL = 'admin.validation.email',
  VALIDATION_STARS_INTEGER = 'admin.validation.starsInteger',
  VALIDATION_STARS_RANGE = 'admin.validation.starsRange',
  ERRORS_SLUG_TAKEN = 'admin.errors.slugTaken',
  ERRORS_MISSING_MEDIA = 'admin.errors.missingMedia',
  PRODUCTS_COLLECTION_NOT_FOUND = 'admin.products.collectionNotFound',
  PRODUCTS_NOT_FOUND = 'admin.products.notFound',
  REVIEWS_RATING_ABOVE_SCALE = 'admin.reviews.ratingAboveScale',
  SETTINGS_SCALE_TOO_LOW = 'admin.settings.scaleTooLow',
}
