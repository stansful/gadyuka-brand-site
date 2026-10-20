import { createTranslator, type Messages } from 'next-intl';

import { DEFAULT_MESSAGES } from '@/i18n/messages';
import type { AdminNamespace, AdminTranslator } from '@/lib/admin/i18n';

import adminRu from '../messages/admin/ru.json';

/**
 * Admin translations in Vitest (no Next.js request scope): the same messages next-intl serves
 * (site defaults + messages/admin/ru.json). Mock the server entry with
 *   vi.mock('next-intl/server', async () => (await import('<…>/test/admin-intl')).nextIntlServerMock);
 */
const MESSAGES: Messages = { ...DEFAULT_MESSAGES.ru, ...adminRu };

export function adminTestTranslator<N extends AdminNamespace>(namespace: N): AdminTranslator<N> {
  return createTranslator({ locale: 'ru', messages: MESSAGES, namespace });
}

/** Stand-in for 'next-intl/server' (only getTranslations({ namespace }) is used by admin code). */
export const nextIntlServerMock = {
  getTranslations: async <N extends AdminNamespace>(options: { namespace: N }): Promise<AdminTranslator<N>> =>
    adminTestTranslator(options.namespace),
};
