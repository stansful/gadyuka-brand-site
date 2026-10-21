/**
 * Error bodies of the backend API. Every 4xx / 5xx answer is one of these two shapes.
 * `key` is a message key of shared/messages (admin/ru.json for the admin, <locale>.json for the
 * site) and `values` its ICU arguments: the frontend translates, the backend never sends prose.
 */

/** ICU arguments of a message key ({ max: 200 }, { minutes: 1 }). */
export type MessageValues = Readonly<Record<string, string | number>>;

/** A translatable message: key + arguments. */
export interface MessageRef {
  readonly key: string;
  readonly values?: MessageValues;
}

/** Machine-readable error codes (`error` of ApiErrorResponse). */
export type ApiErrorCode =
  | 'badRequest'
  | 'internalKeyRequired'
  | 'unauthorized'
  | 'accessTokenInvalid'
  | 'refreshTokenInvalid'
  | 'refreshTokenReused'
  | 'invalidCredentials'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'payloadTooLarge'
  | 'unsupportedMediaType'
  | 'throttled'
  | 'unavailable'
  | 'storageUnavailable'
  | 'internal';

/** Any error except a failed request validation. */
export interface ApiErrorResponse extends MessageRef {
  readonly statusCode: number;
  readonly error: ApiErrorCode;
  /** Extra machine-readable data of some errors (e.g. the failed checks of GET /public/health) */
  readonly details?: Readonly<Record<string, string | number | boolean>>;
}

/**
 * 400 of a request whose body / query / params failed validation. `fields` is keyed by the
 * dotted path of the field ("login", "items.0.title"); "" = the request as a whole.
 */
export interface ApiValidationErrorResponse {
  readonly statusCode: 400;
  readonly error: 'validation';
  readonly fields: Readonly<Record<string, MessageRef>>;
}
