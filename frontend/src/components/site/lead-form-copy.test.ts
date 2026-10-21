import { describe, expect, it } from 'vitest';

import { locales } from '@/i18n/locales';
import { DEFAULT_MESSAGES, defaultMessage, siteTextsFromMessages } from '@/i18n/messages';
import { TEXT_KEYS, type TextKey } from '@/lib/content/registry';
import { LEAD_TOPICS } from '@/lib/lead-form-config';

import { isRequiredKey } from '../../../test/site-text-metadata';
import { leadFormCopy } from './lead-form-copy';

/** Every text as «key» — shows which message each part of the copy is read from. */
const keyTexts = Object.fromEntries(TEXT_KEYS.map(key => [key, `«${key}»`])) as Record<TextKey, string>;

describe('contact form copy (messages contacts.form.*)', () => {
  it('reads every label from exactly one message', () => {
    const copy = leadFormCopy(keyTexts, 'ru');
    expect(copy.labels).toEqual({
      email: '«contacts.form.emailLabel»',
      name: '«contacts.form.nameLabel»',
      phone: '«contacts.form.phoneLabel»',
      message: '«contacts.form.commentLabel»',
    });
    expect(copy.topicLabel).toBe('«contacts.form.topicLabel»');
    expect(copy.subjectLine).toBe('«contacts.form.subjectLine»');
    expect(copy.consent).toBe('«contacts.form.consent»');
    expect(copy.submit).toBe('«contacts.form.submit»');
    expect(copy.success).toBe('«contacts.form.success»');
    for (const topic of LEAD_TOPICS) expect(copy.topics[topic.type]).toBe(keyTexts[topic.key]);
  });

  it('never leaves a field without its label: a blank required message falls back to its default', () => {
    for (const locale of locales) {
      const blank = Object.fromEntries(TEXT_KEYS.map(key => [key, ' '])) as Record<TextKey, string>;
      const copy = leadFormCopy(blank, locale);
      expect(copy.labels.name).toBe(defaultMessage('contacts.form.nameLabel', locale));
      expect(copy.topics.PARTNERSHIP).toBe(defaultMessage('contacts.form.topics.partnership', locale));
      expect(copy.submit).toBe(defaultMessage('contacts.form.submit', locale));
      // optional parts may stay empty
      expect(copy.placeholders.email.trim()).toBe('');
      expect(copy.subjectLine.trim()).toBe('');
    }
    for (const key of ['contacts.form.nameLabel', 'contacts.form.consent', 'contacts.form.topics.contact'] as const) {
      expect(isRequiredKey(key), key).toBe(true);
    }
  });

  it('uses the resolved site messages as they are', () => {
    const texts = siteTextsFromMessages(DEFAULT_MESSAGES.en);
    expect(leadFormCopy(texts, 'en').topics.TAILORING).toBe(DEFAULT_MESSAGES.en.contacts.form.topics.tailoring);
  });
});
