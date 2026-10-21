import { ok } from 'node:assert';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { MessageCatalog, MessagesDirectory } from '~module/messages';

/**
 * Every message key the backend answers with exists in shared/messages: the values of every
 * `src/core/constants/*-message-key.enum.ts` (AdminMessageKey of the foundation and one enum per
 * slice). Keys under "admin." are admin copy (admin/ru.json), the others site messages (ru.json).
 */
describe('message key enums (src/core/constants/*-message-key.enum.ts)', () => {
  const catalog = new MessageCatalog(MessagesDirectory.locate());
  const constantsDirectory = join(__dirname, '..', 'core', 'constants');
  const ENUM_FILE = /-message-key\.enum\.js$/;

  function keyExists(key: string): boolean {
    return key.startsWith('admin.') ? catalog.findAdminMessage(key) !== undefined : catalog.isSiteKey(key);
  }

  async function keysOf(file: string): Promise<string[]> {
    const exported: Record<string, unknown> = await import(join(constantsDirectory, file));
    return Object.values(exported)
      .filter((value): value is Record<string, unknown> => typeof value === 'object' && value !== null)
      .flatMap(enumeration => Object.values(enumeration).filter((key): key is string => typeof key === 'string'));
  }

  it('finds the enums (AdminMessageKey at least)', () => {
    ok(readdirSync(constantsDirectory).includes('admin-message-key.enum.js'));
  });

  it('has every key of every enum in shared/messages', async () => {
    for (const file of readdirSync(constantsDirectory).filter(name => ENUM_FILE.test(name))) {
      for (const key of await keysOf(file)) {
        ok(keyExists(key), `${file}: ${key}`);
      }
    }
  });
});
