import { describe, expect, it } from 'vitest';

import { locales } from '@/i18n/locales';
import { DEFAULT_MESSAGES } from '@/i18n/messages';

import { errorCopyFromMessages } from './error-copy';

describe('error page copy', () => {
  it('comes from the site messages, one source per string (error.*, common.backHome, common.homeLink)', () => {
    for (const locale of locales) {
      const messages = DEFAULT_MESSAGES[locale];
      expect(errorCopyFromMessages(messages), locale).toEqual({
        kicker: messages.error.kicker,
        title: messages.error.title,
        caption: messages.error.caption,
        text: messages.error.text,
        mark: messages.error.mark,
        retry: messages.error.retry,
        backHome: messages.common.backHome,
        homeLink: messages.common.homeLink,
      });
    }
  });

  it('follows the resolved (admin-edited) messages, not the bundled defaults', () => {
    const edited = structuredClone(DEFAULT_MESSAGES.ru);
    edited.error.title = 'Сбой';
    expect(errorCopyFromMessages(edited).title).toBe('Сбой');
  });
});
