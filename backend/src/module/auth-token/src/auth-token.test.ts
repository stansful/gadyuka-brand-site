import { deepStrictEqual, notStrictEqual, ok, rejects, strictEqual, throws } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, it } from 'node:test';

import { JwtService } from '@nestjs/jwt';

import { ConfigService } from '~config';
import { SessionRevokeReason } from '~core/sessions/session-revoke-reason';
import { UserRole } from '~core/users/user-role';
import { AccessTokenInvalidException } from '~exception';
import {
  ACCESS_TOKEN_ALGORITHM,
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
  AccessTokenService,
  AuthSessionService,
  RefreshTokenCodec,
  RefreshTokenInvalidException,
  RefreshTokenReusedException,
} from '~module/auth-token';
import { TestEnvironment } from '~test/test-environment';

import { InMemorySessionRepository } from './test/in-memory-session.repository';

const SECRET = 'test-access-secret-0123456789abcdef-0123456789';
const ACCESS_TTL = 900;
const REFRESH_TTL = 3600;
const ADMIN_ID = randomUUID();

const TOKEN_PARTIES = { issuer: ACCESS_TOKEN_ISSUER, audience: ACCESS_TOKEN_AUDIENCE };

function jwtService(secret = SECRET): JwtService {
  return new JwtService({
    secret,
    signOptions: { algorithm: ACCESS_TOKEN_ALGORITHM, expiresIn: ACCESS_TTL, ...TOKEN_PARTIES },
    verifyOptions: { algorithms: [ACCESS_TOKEN_ALGORITHM], ...TOKEN_PARTIES },
  });
}

const config = new ConfigService(TestEnvironment.valid({ AUTH_REFRESH_TTL: String(REFRESH_TTL) }));

describe('AccessTokenService', () => {
  const service = new AccessTokenService(jwtService());
  const user = { id: ADMIN_ID, role: UserRole.ADMIN, sessionId: randomUUID() };

  it('issues an HS512 token whose claims verify back, expiring after the TTL', () => {
    const before = Date.now();
    const issued = service.issue(user);
    deepStrictEqual(service.verify(issued.token), { sub: user.id, role: UserRole.ADMIN, sid: user.sessionId });
    const lifetime = issued.expiresAt.getTime() - before;
    ok(lifetime > (ACCESS_TTL - 2) * 1000 && lifetime <= (ACCESS_TTL + 1) * 1000, String(lifetime));
    strictEqual(JSON.parse(Buffer.from(issued.token.split('.')[0] ?? '', 'base64url').toString()).alg, 'HS512');
  });

  it('refuses expired, foreign, tampered and claim-less tokens', () => {
    const expired = jwtService().sign({ sub: user.id, role: user.role, sid: user.sessionId }, { expiresIn: -10 });
    const foreign = new AccessTokenService(jwtService('another-secret-0123456789abcdef-0123456789')).issue(user).token;
    const [header, , signature] = service.issue(user).token.split('.');
    const tampered = `${header}.${Buffer.from(JSON.stringify({ sub: user.id, role: 'ADMIN', sid: 'x' })).toString('base64url')}.${signature}`;
    const claimless = jwtService().sign({ hello: 'world' });
    for (const token of [expired, foreign, tampered, claimless, 'not.a.jwt', '']) {
      throws(() => service.verify(token), AccessTokenInvalidException, token);
    }
  });
});

describe('RefreshTokenCodec', () => {
  const codec = new RefreshTokenCodec();

  it('encodes "<id>.<43 base64url chars>" and stores only a sha256 hex hash', () => {
    const { secret, hash } = codec.createSecret();
    ok(/^[A-Za-z0-9_-]{43}$/.test(secret));
    ok(/^[0-9a-f]{64}$/.test(hash));
    const id = randomUUID();
    deepStrictEqual(codec.decode(codec.encode({ id, secret })), { id, secret });
    ok(codec.matches(secret, hash));
    strictEqual(codec.matches(codec.createSecret().secret, hash), false);
  });

  it('rejects malformed tokens', () => {
    for (const token of [
      '',
      'abc',
      `${randomUUID()}.short`,
      `not-a-uuid.${'a'.repeat(43)}`,
      `${randomUUID()}.${'a'.repeat(43)}.x`,
    ]) {
      strictEqual(codec.decode(token), undefined, token);
    }
  });
});

describe('AuthSessionService', () => {
  let repository: InMemorySessionRepository;
  let sessions: AuthSessionService;

  beforeEach(() => {
    repository = new InMemorySessionRepository(new Map([[ADMIN_ID, UserRole.ADMIN]]));
    sessions = new AuthSessionService(
      repository,
      new AccessTokenService(jwtService()),
      new RefreshTokenCodec(),
      config,
    );
  });

  it('starts a session: an access token of that session and a refresh token valid for the refresh TTL', async () => {
    const tokens = await sessions.start({ userId: ADMIN_ID, role: UserRole.ADMIN, userAgent: 'x'.repeat(600) });
    const user = await sessions.authenticate(tokens.access.token);
    strictEqual(user.id, ADMIN_ID);
    strictEqual(user.role, UserRole.ADMIN);
    strictEqual(repository.sessions.get(user.sessionId)?.userAgent?.length, 512);
    const lifetime = tokens.refresh.expiresAt.getTime() - Date.now();
    ok(lifetime > (REFRESH_TTL - 5) * 1000 && lifetime <= REFRESH_TTL * 1000);
    ok(
      ![...repository.tokens.values()].some(token => tokens.refresh.token.includes(token.tokenHash)),
      'only the hash is stored',
    );
  });

  it('rotates: a refresh returns a new pair of the same session, the old refresh token stops working', async () => {
    const first = await sessions.start({ userId: ADMIN_ID, role: UserRole.ADMIN, userAgent: undefined });
    const second = await sessions.refresh(first.refresh.token);
    notStrictEqual(second.refresh.token, first.refresh.token);
    const firstUser = await sessions.authenticate(first.access.token);
    strictEqual((await sessions.authenticate(second.access.token)).sessionId, firstUser.sessionId);
    const third = await sessions.refresh(second.refresh.token);
    ok(third.refresh.token.length > 0);
  });

  it('detects reuse of an exchanged refresh token and revokes the whole session', async () => {
    const first = await sessions.start({ userId: ADMIN_ID, role: UserRole.ADMIN, userAgent: undefined });
    const second = await sessions.refresh(first.refresh.token);
    await rejects(sessions.refresh(first.refresh.token), RefreshTokenReusedException);
    const sessionId = (await repository.findRefreshToken(first.refresh.token.split('.')[0] ?? ''))?.sessionId ?? '';
    strictEqual(repository.sessions.get(sessionId)?.revokeReason, SessionRevokeReason.TOKEN_REUSE);
    await rejects(sessions.refresh(second.refresh.token), RefreshTokenInvalidException, 'the successor dies too');
    await rejects(sessions.authenticate(second.access.token), AccessTokenInvalidException, 'and every access token');
  });

  it('refuses expired, unknown, malformed and forged refresh tokens', async () => {
    const tokens = await sessions.start({ userId: ADMIN_ID, role: UserRole.ADMIN, userAgent: undefined });
    const [id] = tokens.refresh.token.split('.');
    const forged = `${id}.${new RefreshTokenCodec().createSecret().secret}`;
    for (const token of [forged, `${randomUUID()}.${'a'.repeat(43)}`, 'garbage']) {
      await rejects(sessions.refresh(token), RefreshTokenInvalidException, token);
    }
    const stored = repository.tokens.get(id ?? '');
    ok(stored !== undefined);
    stored.expiresAt = new Date(Date.now() - 1000);
    await rejects(sessions.refresh(tokens.refresh.token), RefreshTokenInvalidException);
    strictEqual(
      repository.sessions.get(stored.sessionId)?.revokedAt,
      null,
      'a forged secret or an expiry revokes nothing',
    );
  });

  it('logout ends the session (refresh and access), and ignores unknown tokens', async () => {
    const tokens = await sessions.start({ userId: ADMIN_ID, role: UserRole.ADMIN, userAgent: undefined });
    await sessions.end('garbage');
    await sessions.end(tokens.refresh.token);
    await sessions.end(tokens.refresh.token);
    await rejects(sessions.refresh(tokens.refresh.token), RefreshTokenInvalidException);
    await rejects(sessions.authenticate(tokens.access.token), AccessTokenInvalidException);
  });

  it('revokes every session of a user (password change)', async () => {
    const first = await sessions.start({ userId: ADMIN_ID, role: UserRole.ADMIN, userAgent: undefined });
    await sessions.start({ userId: ADMIN_ID, role: UserRole.ADMIN, userAgent: undefined });
    strictEqual(await sessions.revokeAllForUser(ADMIN_ID, SessionRevokeReason.PASSWORD_CHANGE), 2);
    await rejects(sessions.authenticate(first.access.token), AccessTokenInvalidException);
  });
});
