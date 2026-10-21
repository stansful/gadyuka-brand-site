import { ThrottlerOptions } from '@nestjs/throttler';

/** POST /auth/login: 5 attempts per minute per visitor IP + login, then 5 minutes of 429. */
export const LOGIN_THROTTLER: ThrottlerOptions = {
  name: 'login',
  ttl: 60_000,
  limit: 5,
  blockDuration: 5 * 60_000,
};
