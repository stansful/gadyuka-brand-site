/**
 * What references a media file (shared/contracts/media.ts `MediaUsageKind`; the admin names them
 * with admin.media.usages.<kind>). The declaration order is the order the admin lists them in.
 */
export enum MediaUsageKind {
  LANDING_IMAGE = 'landingImage',
  COLLECTION_COVER = 'collectionCover',
  PRODUCT_PHOTO = 'productPhoto',
  REVIEW_AVATAR = 'reviewAvatar',
  NEWS = 'news',
  GALLERY = 'gallery',
  OFFER = 'offer',
  PARTNER_LOGO = 'partnerLogo',
  SETTINGS = 'settings',
}
