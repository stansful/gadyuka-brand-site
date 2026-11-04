import { Algorithm } from 'jsonwebtoken';

export const SESSION_REPOSITORY = Symbol('session-repository');

/** HS512 JWT of the access tokens: issuer and audience are checked on every request. */
export const ACCESS_TOKEN_ALGORITHM: Algorithm = 'HS512';
export const ACCESS_TOKEN_ISSUER = 'gadyuka-backend';
export const ACCESS_TOKEN_AUDIENCE = 'gadyuka-admin';

/** Random bytes of the secret part of a refresh token (base64url: 43 characters). */
export const REFRESH_TOKEN_SECRET_BYTES = 32;

/** Longest User-Agent stored with a session. */
export const MAX_USER_AGENT_LENGTH = 512;
