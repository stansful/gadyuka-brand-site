import { randomUUID } from 'node:crypto';

import { SessionRevokeReason } from '~core/sessions/session-revoke-reason';
import { UserRole } from '~core/users/user-role';

import {
  ISessionRepository,
  NewRefreshToken,
  RefreshTokenRotation,
  StoredRefreshToken,
} from '../auth-token.interfaces';

interface SessionRow {
  readonly id: string;
  readonly userId: string;
  readonly userAgent: string | undefined;
  revokedAt: Date | null;
  revokeReason: SessionRevokeReason | null;
}

interface TokenRow extends NewRefreshToken {
  readonly id: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
}

/** ISessionRepository for unit tests (same semantics as SessionRepository, no database). */
export class InMemorySessionRepository implements ISessionRepository {
  readonly sessions = new Map<string, SessionRow>();
  readonly tokens = new Map<string, TokenRow>();

  constructor(private readonly roles: ReadonlyMap<string, UserRole>) {}

  async createSession(userId: string, userAgent: string | undefined): Promise<string> {
    const id = randomUUID();
    this.sessions.set(id, { id, userId, userAgent, revokedAt: null, revokeReason: null });
    return id;
  }

  async createRefreshToken(token: NewRefreshToken): Promise<string> {
    const id = randomUUID();
    this.tokens.set(id, { ...token, id, revokedAt: null, replacedById: null });
    return id;
  }

  async findRefreshToken(id: string): Promise<StoredRefreshToken | null> {
    const token = this.tokens.get(id);
    const session = token === undefined ? undefined : this.sessions.get(token.sessionId);
    if (token === undefined || session === undefined) {
      return null;
    }
    const role = this.roles.get(session.userId) ?? UserRole.USER;
    return { ...token, session: { userId: session.userId, role, revokedAt: session.revokedAt } };
  }

  async rotateRefreshToken({ currentId, next }: RefreshTokenRotation): Promise<string | null> {
    const current = this.tokens.get(currentId);
    if (current === undefined || current.revokedAt !== null) {
      return null;
    }
    const nextId = await this.createRefreshToken(next);
    current.revokedAt = new Date();
    current.replacedById = nextId;
    return nextId;
  }

  async findActiveSessionUser(sessionId: string): Promise<{ userId: string; role: UserRole } | null> {
    const session = this.sessions.get(sessionId);
    if (session === undefined || session.revokedAt !== null) {
      return null;
    }
    return { userId: session.userId, role: this.roles.get(session.userId) ?? UserRole.USER };
  }

  async revokeSession(sessionId: string, reason: SessionRevokeReason): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session === undefined || session.revokedAt !== null) {
      return;
    }
    session.revokedAt = new Date();
    session.revokeReason = reason;
    this.tokens.forEach(token => this.revokeToken(token, sessionId));
  }

  async revokeUserSessions(userId: string, reason: SessionRevokeReason): Promise<number> {
    const open = [...this.sessions.values()].filter(session => session.userId === userId && session.revokedAt === null);
    await Promise.all(open.map(session => this.revokeSession(session.id, reason)));
    return open.length;
  }

  private revokeToken(token: TokenRow, sessionId: string): void {
    if (token.sessionId === sessionId && token.revokedAt === null) {
      token.revokedAt = new Date();
    }
  }
}
