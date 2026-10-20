import { describe, expect, it } from 'vitest';

import { DEFAULT_MESSAGES, siteTextsFromMessages } from '@/i18n/messages';

import { formatMonthYear, formatShortDate, pad2, ratingStars, socialLabel } from './format';

describe('dates and numbers', () => {
  it('prints the newspaper dateline and the masthead month', () => {
    expect(formatShortDate('2026-10-01T09:00:00.000Z', 'ru')).toBe('01.10.2026');
    expect(formatMonthYear('2026-10-10T09:00:00.000Z', 'ru')).toBe('Октябрь 2026');
    expect(formatMonthYear('2026-10-10T09:00:00.000Z', 'en')).toBe('October 2026');
  });

  it('pads chapter numbers', () => {
    expect(pad2(2)).toBe('02');
    expect(pad2(12)).toBe('12');
  });
});

describe('review stars', () => {
  it('draws the rating on the star scale of the settings', () => {
    expect(ratingStars(4, 5)).toBe('★★★★☆');
    expect(ratingStars(7, 10)).toBe('★★★★★★★☆☆☆');
    expect(ratingStars(3, 3)).toBe('★★★');
  });

  it('never draws more stars than the scale, nor a broken scale', () => {
    expect(ratingStars(9, 5)).toBe('★★★★★');
    expect(ratingStars(0, 5)).toBe('☆☆☆☆☆');
    expect(ratingStars(1, 0)).toBe('★');
  });
});

describe('social link names', () => {
  const ru = siteTextsFromMessages(DEFAULT_MESSAGES.ru);
  const en = siteTextsFromMessages(DEFAULT_MESSAGES.en);

  it("prefers the link's own label", () => {
    expect(socialLabel({ type: 'TELEGRAM', url: 'https://t.me/x', label: 'Канал' }, ru)).toBe('Канал');
  });

  it('falls back to the default name of the type (message social.<TYPE>)', () => {
    expect(socialLabel({ type: 'VK', url: 'https://vk.com/x', label: null }, ru)).toBe(DEFAULT_MESSAGES.ru.social.VK);
    expect(socialLabel({ type: 'WEBSITE', url: 'https://x.ru', label: null }, en)).toBe(
      DEFAULT_MESSAGES.en.social.WEBSITE,
    );
  });

  it('names an unlabelled OTHER link after its host', () => {
    expect(socialLabel({ type: 'OTHER', url: 'https://www.behance.net/gadyuka', label: null }, ru)).toBe('behance.net');
    expect(socialLabel({ type: 'OTHER', url: 'not a url', label: null }, en)).toBe(DEFAULT_MESSAGES.en.social.OTHER);
  });
});
