import { randomInt } from 'node:crypto';

/** A random visitor IP (x-client-ip), so rate limits of one test never meet another's. */
export class TestClientIp {
  static random(): string {
    return `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
  }
}
