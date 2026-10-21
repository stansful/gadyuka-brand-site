import { Inject, Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '~config';
import { MILLISECONDS_PER_SECOND } from '~core/constants/time.constants';
import { SessionRevokeReason } from '~core/sessions/session-revoke-reason';
import { AccessTokenInvalidException } from '~exception';

import { AccessTokenService } from './access-token.service';
import { MAX_USER_AGENT_LENGTH, SESSION_REPOSITORY } from './auth-token.constants';
import {
  AuthenticatedUser,
  ISessionRepository,
  IssuedToken,
  SessionStart,
  SessionTokens,
  StoredRefreshToken,
} from './auth-token.interfaces';
import { RefreshTokenInvalidException } from './refresh-token-invalid.exception';
import { RefreshTokenReusedException } from './refresh-token-reused.exception';
import { RefreshTokenCodec } from './refresh-token.codec';

/**
 * Admin sessions = a short access JWT + a rotating refresh token stored hashed in the database.
 * - start: a new session (refresh-token family) with its first token pair;
 * - refresh: exchanges a refresh token for a new pair, at most once; presenting an exchanged token
 *   again (a stolen copy, or the thief after the owner) revokes the whole session;
 * - end: revokes the session of a refresh token (logout);
 * - authenticate: a valid access token of a session that is not revoked.
 */
@Injectable()
export class AuthSessionService {
  private readonly logger = new Logger(AuthSessionService.name);

  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: ISessionRepository,
    private readonly accessTokens: AccessTokenService,
    private readonly codec: RefreshTokenCodec,
    private readonly config: ConfigService,
  ) {}

  async start({ userId, role, userAgent }: SessionStart): Promise<SessionTokens> {
    const sessionId = await this.sessions.createSession(userId, userAgent?.slice(0, MAX_USER_AGENT_LENGTH));
    const refresh = await this.issueRefreshToken(sessionId);
    return { access: this.accessTokens.issue({ id: userId, role, sessionId }), refresh };
  }

  async refresh(refreshToken: string): Promise<SessionTokens> {
    const stored = await this.findUsableToken(refreshToken);
    const refresh = await this.rotate(stored);
    const { userId, role } = stored.session;
    return { access: this.accessTokens.issue({ id: userId, role, sessionId: stored.sessionId }), refresh };
  }

  /** Logout. An unknown, malformed or already revoked token is ignored (logout is idempotent). */
  async end(refreshToken: string): Promise<void> {
    const stored = await this.findMatchingToken(refreshToken);
    if (stored !== null) {
      await this.sessions.revokeSession(stored.sessionId, SessionRevokeReason.LOGOUT);
    }
  }

  async authenticate(accessToken: string): Promise<AuthenticatedUser> {
    const claims = this.accessTokens.verify(accessToken);
    const active = await this.sessions.findActiveSessionUser(claims.sid);
    if (active === null || active.userId !== claims.sub) {
      throw new AccessTokenInvalidException();
    }
    return { id: active.userId, role: active.role, sessionId: claims.sid };
  }

  /** Ends every session of a user (password change); returns how many were open. */
  revokeAllForUser(userId: string, reason: SessionRevokeReason): Promise<number> {
    return this.sessions.revokeUserSessions(userId, reason);
  }

  private async issueRefreshToken(sessionId: string): Promise<IssuedToken> {
    const { secret, hash } = this.codec.createSecret();
    const expiresAt = this.refreshExpiry();
    const id = await this.sessions.createRefreshToken({ sessionId, tokenHash: hash, expiresAt });
    return { token: this.codec.encode({ id, secret }), expiresAt };
  }

  /** Exchanges `stored` for a new refresh token; losing a concurrent exchange counts as reuse. */
  private async rotate(stored: StoredRefreshToken): Promise<IssuedToken> {
    const { secret, hash } = this.codec.createSecret();
    const expiresAt = this.refreshExpiry();
    const next = { sessionId: stored.sessionId, tokenHash: hash, expiresAt };
    const nextId = await this.sessions.rotateRefreshToken({ currentId: stored.id, next });
    if (nextId === null) {
      return this.revokeReusedFamily(stored);
    }
    return { token: this.codec.encode({ id: nextId, secret }), expiresAt };
  }

  /**
   * The stored token of a refresh request that may be exchanged now. An exchanged token of a live
   * session is a reuse (the session is revoked); anything else unusable is just invalid.
   */
  private async findUsableToken(refreshToken: string): Promise<StoredRefreshToken> {
    const stored = await this.findMatchingToken(refreshToken);
    if (stored !== null && stored.replacedById !== null && stored.session.revokedAt === null) {
      return this.revokeReusedFamily(stored);
    }
    if (stored === null || !this.isUsable(stored)) {
      throw new RefreshTokenInvalidException();
    }
    return stored;
  }

  private isUsable(stored: StoredRefreshToken): boolean {
    return stored.session.revokedAt === null && stored.revokedAt === null && stored.expiresAt.getTime() > Date.now();
  }

  /** The stored token whose secret matches `refreshToken`, or null. */
  private async findMatchingToken(refreshToken: string): Promise<StoredRefreshToken | null> {
    const parts = this.codec.decode(refreshToken);
    if (parts === undefined) {
      return null;
    }
    const stored = await this.sessions.findRefreshToken(parts.id);
    return stored !== null && this.codec.matches(parts.secret, stored.tokenHash) ? stored : null;
  }

  private async revokeReusedFamily(stored: StoredRefreshToken): Promise<never> {
    await this.sessions.revokeSession(stored.sessionId, SessionRevokeReason.TOKEN_REUSE);
    this.logger.warn('AuthSessionService : refresh token reused, session revoked', { session_id: stored.sessionId });
    throw new RefreshTokenReusedException();
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.config.getSafety('AUTH_REFRESH_TTL') * MILLISECONDS_PER_SECOND);
  }
}
