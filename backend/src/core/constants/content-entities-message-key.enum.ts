/**
 * Message keys of the admin content entities (slice S4b: news, gallery, offers, partners, menu items,
 * social links) — shared/messages/admin/ru.json. The general ones (tooLong, invalid, idInvalid …) are
 * in AdminMessageKey. Checked by src/test/message-keys.test.ts.
 */
export enum ContentEntitiesMessageKey {
  VALIDATION_ID_REQUIRED = 'admin.validation.idRequired',
  VALIDATION_SLUG_REQUIRED = 'admin.validation.slugRequired',
  VALIDATION_SLUG_FORMAT = 'admin.validation.slugFormat',
  VALIDATION_REQUIRED_TEXT = 'admin.validation.requiredText',
  VALIDATION_DATE_REQUIRED = 'admin.validation.dateRequired',
  VALIDATION_SITE_HREF = 'admin.validation.siteHref',
  VALIDATION_HTTP_URL = 'admin.validation.httpUrl',
  VALIDATION_NAME_REQUIRED = 'admin.validation.nameRequired',
  VALIDATION_HREF_REQUIRED = 'admin.validation.hrefRequired',
  VALIDATION_HREF_BARE_HASH = 'admin.validation.hrefBareHash',
  VALIDATION_SOCIAL_TYPE = 'admin.validation.socialType',
  VALIDATION_PHOTOS_REQUIRED = 'admin.validation.photosRequired',
  VALIDATION_PHOTOS_BULK_TOO_MANY = 'admin.validation.photosBulkTooMany',
  VALIDATION_PHOTOS_DUPLICATE = 'admin.validation.photosDuplicate',
  ERRORS_MISSING_MEDIA = 'admin.errors.missingMedia',
  ERRORS_SLUG_TAKEN = 'admin.errors.slugTaken',
  OFFERS_CTA_HREF_REQUIRED = 'admin.offers.ctaHrefRequired',
}
