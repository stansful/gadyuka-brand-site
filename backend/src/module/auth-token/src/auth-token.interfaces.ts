import { SessionRevokeReason } from '~core/sessions/session-revoke-reason';
import { UserRole } from '~core/users/user-role';

/** Claims of an access token: the user, their role and the session (refresh-token family). */
export interface AccessTokenClaims {
  readonly sub: string;
  readonly role: UserRole;
  readonly sid: string;
}

/** The signed-in user of a request (set by AuthGuard, read with @CurrentUser()). */
export interface AuthenticatedUser {
  readonly id: string;
  readonly role: UserRole;
  readonly sessionId: string;
}

export interface IssuedToken {
  readonly token: string;
  readonly expiresAt: Date;
}

export interface SessionTokens {
  readonly access: IssuedToken;
  readonly refresh: IssuedToken;
}

export interface SessionStart {
  readonly userId: string;
  readonly role: UserRole;
  readonly userAgent: string | undefined;
}

/** A refresh token row with what the rotation needs to know about its session. */
export interface StoredRefreshToken {
  readonly id: string;
  readonly sessionId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly replacedById: string | null;
  readonly session: { readonly userId: string; readonly role: UserRole; readonly revokedAt: Date | null };
}

export interface NewRefreshToken {
  readonly sessionId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export interface RefreshTokenRotation {
  /** The token being exchanged */
  readonly currentId: string;
  readonly next: NewRefreshToken;
}

/** Persistence of sessions and refresh tokens (Prisma in the app, in memory in unit tests). */
export interface ISessionRepository {
  createSession(userId: string, userAgent: string | undefined): Promise<string>;
  createRefreshToken(token: NewRefreshToken): Promise<string>;
  findRefreshToken(id: string): Promise<StoredRefreshToken | null>;
  /** Atomically retires `currentId` and stores its successor; null when `currentId` was already retired. */
  rotateRefreshToken(rotation: RefreshTokenRotation): Promise<string | null>;
  /** The user of a session that is not revoked, or null. */
  findActiveSessionUser(sessionId: string): Promise<{ readonly userId: string; readonly role: UserRole } | null>;
  revokeSession(sessionId: string, reason: SessionRevokeReason): Promise<void>;
  revokeUserSessions(userId: string, reason: SessionRevokeReason): Promise<number>;
}
