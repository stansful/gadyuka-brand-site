import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { REFRESH_TOKEN_SECRET_BYTES } from './auth-token.constants';

export interface RefreshTokenSecret {
  /** Handed out once, never stored */
  readonly secret: string;
  /** sha256 hex of the secret: the only thing the database keeps */
  readonly hash: string;
}

export interface RefreshTokenParts {
  readonly id: string;
  readonly secret: string;
}

/** Refresh tokens are "<refresh token id>.<32 random bytes, base64url>". */
@Injectable()
export class RefreshTokenCodec {
  private static readonly SEPARATOR = '.';
  private static readonly FORMAT =
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;

  createSecret(): RefreshTokenSecret {
    const secret = randomBytes(REFRESH_TOKEN_SECRET_BYTES).toString('base64url');
    return { secret, hash: this.hash(secret) };
  }

  encode({ id, secret }: RefreshTokenParts): string {
    return `${id}${RefreshTokenCodec.SEPARATOR}${secret}`;
  }

  /** The parts of a well-formed token, undefined otherwise. */
  decode(token: string): RefreshTokenParts | undefined {
    const match = RefreshTokenCodec.FORMAT.exec(token);
    if (match === null || match[1] === undefined || match[2] === undefined) {
      return undefined;
    }
    return { id: match[1], secret: match[2] };
  }

  /** Constant-time comparison of a presented secret with the stored hash. */
  matches(secret: string, storedHash: string): boolean {
    const presented = Buffer.from(this.hash(secret), 'hex');
    const stored = Buffer.from(storedHash, 'hex');
    return presented.length === stored.length && timingSafeEqual(presented, stored);
  }

  private hash(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }
}
