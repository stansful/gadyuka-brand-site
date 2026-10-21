import { describe, expect, it } from 'vitest';

import { formatCalendarDay, todayInMoscow } from './content-entities';

describe('content entity display helpers', () => {
  it('names today in Moscow (the next day already after 21:00 UTC)', () => {
    expect(todayInMoscow(new Date('2026-10-31T20:59:59.999Z'))).toBe('2026-10-31');
    expect(todayInMoscow(new Date('2026-10-31T21:00:00.000Z'))).toBe('2026-11-01');
  });

  it('shows a calendar day the Russian way', () => {
    expect(formatCalendarDay('2026-10-31')).toBe('31.10.2026');
  });
});
