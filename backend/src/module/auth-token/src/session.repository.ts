import { Injectable } from '@nestjs/common';

import { SessionRevokeReason } from '~core/sessions/session-revoke-reason';
import { UserRole } from '~core/users/user-role';
import { DatabaseService } from '~database';
import { Prisma } from '~prisma-generated/prisma/client';

import { ISessionRepository, NewRefreshToken, RefreshTokenRotation, StoredRefreshToken } from './auth-token.interfaces';

const STORED_TOKEN_SELECT = {
  id: true,
  sessionId: true,
  tokenHash: true,
  expiresAt: true,
  revokedAt: true,
  replacedById: true,
  session: { select: { userId: true, revokedAt: true, user: { select: { role: true } } } },
} satisfies Prisma.RefreshTokenSelect;

type StoredTokenRow = Prisma.RefreshTokenGetPayload<{ select: typeof STORED_TOKEN_SELECT }>;

type SessionScope = { id: string } | { userId: string };

/** Sessions and refresh tokens in Postgres (tables sessions, refresh_tokens). */
@Injectable()
export class SessionRepository implements ISessionRepository {
  constructor(private readonly database: DatabaseService) {}

  async createSession(userId: string, userAgent: string | undefined): Promise<string> {
    const session = await this.database.client.session.create({ data: { userId, userAgent }, select: { id: true } });
    return session.id;
  }

  async createRefreshToken(token: NewRefreshToken): Promise<string> {
    const created = await this.database.client.refreshToken.create({ data: token, select: { id: true } });
    return created.id;
  }

  async findRefreshToken(id: string): Promise<StoredRefreshToken | null> {
    const row = await this.database.client.refreshToken.findUnique({ where: { id }, select: STORED_TOKEN_SELECT });
    return row === null ? null : this.toStoredToken(row);
  }

  /** One transaction; the conditional retire makes a concurrent second exchange see 0 rows. */
  rotateRefreshToken(rotation: RefreshTokenRotation): Promise<string | null> {
    return this.database.client.$transaction(transaction => this.rotateWithin(transaction, rotation));
  }

  async findActiveSessionUser(sessionId: string): Promise<{ userId: string; role: UserRole } | null> {
    const session = await this.database.client.session.findFirst({
      where: { id: sessionId, revokedAt: null },
      select: { userId: true, user: { select: { role: true } } },
    });
    return session === null ? null : { userId: session.userId, role: session.user.role };
  }

  async revokeSession(sessionId: string, reason: SessionRevokeReason): Promise<void> {
    await this.revokeSessions({ id: sessionId }, reason);
  }

  revokeUserSessions(userId: string, reason: SessionRevokeReason): Promise<number> {
    return this.revokeSessions({ userId }, reason);
  }

  private async rotateWithin(
    transaction: Prisma.TransactionClient,
    { currentId, next }: RefreshTokenRotation,
  ): Promise<string | null> {
    const now = new Date();
    if (!(await this.retireToken(transaction, currentId, now))) {
      return null;
    }
    const created = await transaction.refreshToken.create({ data: next, select: { id: true } });
    await transaction.refreshToken.update({ where: { id: currentId }, data: { replacedById: created.id } });
    await transaction.session.update({ where: { id: next.sessionId }, data: { lastUsedAt: now } });
    return created.id;
  }

  /** Marks the token exchanged unless it already was; true when this call did it. */
  private async retireToken(transaction: Prisma.TransactionClient, id: string, now: Date): Promise<boolean> {
    const retired = await transaction.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: now },
    });
    return retired.count > 0;
  }

  private async revokeSessions(scope: SessionScope, reason: SessionRevokeReason): Promise<number> {
    const now = new Date();
    const [sessions] = await this.database.client.$transaction([
      this.database.client.session.updateMany({
        where: { ...scope, revokedAt: null },
        data: { revokedAt: now, revokeReason: reason },
      }),
      this.revokeTokensOf(scope, now),
    ]);
    return sessions.count;
  }

  private revokeTokensOf(scope: SessionScope, now: Date): Prisma.PrismaPromise<Prisma.BatchPayload> {
    return this.database.client.refreshToken.updateMany({
      where: { session: scope, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  private toStoredToken({ session, ...token }: StoredTokenRow): StoredRefreshToken {
    return { ...token, session: { userId: session.userId, role: session.user.role, revokedAt: session.revokedAt } };
  }
}
