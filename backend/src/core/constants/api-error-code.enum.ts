/** `error` of the error bodies (shared/contracts/errors.ts). */
export enum ApiErrorCode {
  BAD_REQUEST = 'badRequest',
  INTERNAL_KEY_REQUIRED = 'internalKeyRequired',
  UNAUTHORIZED = 'unauthorized',
  ACCESS_TOKEN_INVALID = 'accessTokenInvalid',
  REFRESH_TOKEN_INVALID = 'refreshTokenInvalid',
  REFRESH_TOKEN_REUSED = 'refreshTokenReused',
  INVALID_CREDENTIALS = 'invalidCredentials',
  FORBIDDEN = 'forbidden',
  NOT_FOUND = 'notFound',
  CONFLICT = 'conflict',
  PAYLOAD_TOO_LARGE = 'payloadTooLarge',
  UNSUPPORTED_MEDIA_TYPE = 'unsupportedMediaType',
  THROTTLED = 'throttled',
  UNAVAILABLE = 'unavailable',
  STORAGE_UNAVAILABLE = 'storageUnavailable',
  INTERNAL = 'internal',
}
