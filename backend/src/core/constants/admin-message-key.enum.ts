/**
 * General keys of shared/messages/admin/ru.json the backend answers with (the admin translates them):
 * auth, generic errors and validation, media, the shared list operations. A unit test
 * (src/test/message-keys.test.ts) checks that every key exists.
 *
 * Owned by the foundation: a slice declares the keys of its own area in its own enum,
 * src/core/constants/<slice>-message-key.enum.ts (e.g. CatalogMessageKey) — the same test finds
 * every `*-message-key.enum.ts` and checks it too.
 */
export enum AdminMessageKey {
  AUTH_LOGIN_REQUIRED = 'admin.auth.loginRequired',
  AUTH_PASSWORD_REQUIRED = 'admin.auth.passwordRequired',
  AUTH_INVALID_CREDENTIALS = 'admin.auth.invalidCredentials',
  AUTH_SESSION_REQUIRED = 'admin.auth.sessionRequired',
  AUTH_THROTTLED = 'admin.auth.throttled',
  ERRORS_SESSION_EXPIRED = 'admin.errors.sessionExpired',
  ERRORS_FORBIDDEN = 'admin.errors.forbidden',
  ERRORS_NOT_FOUND = 'admin.errors.notFound',
  ERRORS_INVALID_REQUEST = 'admin.errors.invalidRequest',
  ERRORS_ACTION_FAILED = 'admin.errors.actionFailed',
  ERRORS_NETWORK = 'admin.errors.network',
  ERRORS_DUPLICATE = 'admin.errors.duplicate',
  ERRORS_RELATED = 'admin.errors.related',
  ERRORS_INVALID_ID = 'admin.errors.invalidId',
  ERRORS_MISSING_MEDIA = 'admin.errors.missingMedia',
  VALIDATION_REQUIRED = 'admin.validation.required',
  VALIDATION_INVALID = 'admin.validation.invalid',
  VALIDATION_UNKNOWN_FIELD = 'admin.validation.unknownField',
  VALIDATION_TOO_LONG = 'admin.validation.tooLong',
  VALIDATION_REQUIRED_TEXT = 'admin.validation.requiredText',
  VALIDATION_ID_INVALID = 'admin.validation.idInvalid',
  VALIDATION_LIST_DUPLICATE = 'admin.validation.listDuplicate',
  ENTITIES_INVALID_ORDER = 'admin.entities.invalidOrder',
  MEDIA_ERRORS_EMPTY = 'admin.media.errors.empty',
  MEDIA_ERRORS_TOO_LARGE = 'admin.media.errors.tooLarge',
  MEDIA_ERRORS_UNSUPPORTED = 'admin.media.errors.unsupported',
  MEDIA_ERRORS_PROCESSING_FAILED = 'admin.media.errors.processingFailed',
  MEDIA_ERRORS_NOT_FOUND = 'admin.media.errors.notFound',
  MEDIA_ERRORS_FILE_TOO_LARGE = 'admin.media.errors.fileTooLarge',
  COMMON_ADMIN_USER_NAME = 'admin.common.adminUserName',
}
