import { describe, expect, it } from 'vitest';

import {
  PICTURE_SLOTS,
  aspectOf,
  coverSizes,
  galleryLayout,
  newsColumns,
  newsPictureSlots,
  partnerPlaceholderCount,
  reviewPanels,
  stampSizes,
} from './layout-rules';

/** Desktop column span of a gallery cell (12-column grid, as in noir.css). */
const SPAN = { a: 7, b: 5, c: 5, d: 3, e: 6, f: 3, g: 6, h: 6 } as const;

describe('galleryLayout', () => {
  it("repeats the concept's 8-panel page", () => {
    const slots = galleryLayout(16)
      .map(cell => cell.slot)
      .join('');
    expect(slots).toBe('abcdefghabcdefgh');
    expect(galleryLayout(8).every(cell => !cell.full && !cell.tall)).toBe(true);
  });

  it('closes every row of an incomplete last page', () => {
    for (let count = 1; count <= 24; count++) {
      const rest = galleryLayout(count).slice(Math.floor(count / 8) * 8);
      // Rows: «a» pairs with b+c (or a tall b); the rest must add up to full 12-column rows.
      const afterAbc = rest.filter(cell => !['a', 'b', 'c'].includes(cell.slot));
      const cols = afterAbc.reduce((sum, cell) => sum + (cell.full ? 12 : SPAN[cell.slot]), 0);
      expect(cols % 12, `count ${count}`).toBe(0);
      const a = rest.find(cell => cell.slot === 'a');
      const right = rest.filter(cell => cell.slot === 'b' || cell.slot === 'c');
      if (a && !a.full) expect(right.length === 2 || right.some(cell => cell.tall), `count ${count}`).toBe(true);
    }
  });

  it('gives every cell a wipe direction and responsive sizes', () => {
    for (const cell of galleryLayout(9)) {
      expect(['left', 'right', 'up', 'down', 'diag']).toContain(cell.wipe);
      expect(cell.sizes).toMatch(/vw|px/);
      expect(cell.slots.length).toBeGreaterThan(0);
    }
    expect(galleryLayout(0)).toEqual([]);
  });
});

describe('reviewPanels', () => {
  it('pairs panels and widens an odd last one', () => {
    expect(reviewPanels(3).map(panel => `${panel.variant}${panel.wide ? '!' : ''}`)).toEqual(['a', 'b', 'c!']);
    expect(reviewPanels(4).some(panel => panel.wide)).toBe(false);
    expect(reviewPanels(5).map(panel => panel.variant)).toEqual(['a', 'b', 'c', 'd', 'a']);
    expect(reviewPanels(0)).toEqual([]);
  });
});

describe('partnerPlaceholderCount', () => {
  it('keeps at least four slots and an even grid', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(partnerPlaceholderCount)).toEqual([4, 3, 2, 1, 0, 1, 0, 1]);
  });
});

describe('newsColumns', () => {
  it('adapts the newspaper columns to the number of stories', () => {
    expect([0, 1, 2, 3, 12].map(newsColumns)).toEqual([1, 1, 2, 3, 3]);
  });
});

describe('coverSizes', () => {
  it('widens the request for pictures cropped at the sides by object-fit: cover', () => {
    // A 4:3 product photo on a 2:3 cover is drawn about twice as wide as the cover itself.
    expect(coverSizes(4 / 3, PICTURE_SLOTS.cover)).toBe('(max-width: 699px) 150vw, (max-width: 1023px) 106vw, 48vw');
    // A portrait picture already fills the width: the slot width as is.
    expect(coverSizes(0.5, PICTURE_SLOTS.cover)).toBe('(max-width: 699px) 76vw, (max-width: 1023px) 50vw, 24vw');
  });

  it('falls back to the slot width when the aspect is unknown', () => {
    expect(coverSizes(Number.NaN, [{ vw: 30, aspect: 1 }])).toBe('30vw');
    expect(
      coverSizes(0, [
        { maxWidth: 699, vw: 50, aspect: 1 },
        { vw: 25, aspect: 1 },
      ]),
    ).toBe('(max-width: 699px) 50vw, 25vw');
    expect(aspectOf(null)).toBe(0);
    expect(aspectOf({ width: 1600, height: 900 })).toBeCloseTo(16 / 9);
  });

  it("sizes gallery cells by the picture's aspect", () => {
    const [d] = galleryLayout(8).filter(cell => cell.slot === 'd');
    expect(d).toBeDefined();
    if (!d) return;
    expect(coverSizes(16 / 9, d.slots)).not.toBe(d.sizes);
    expect(coverSizes(16 / 9, d.slots)).toMatch(/^\(max-width: 699px\) \d+vw, \(max-width: 1023px\) \d+vw, \d+vw$/);
  });

  it('follows the newspaper columns and sizes the coupon stamp in pixels', () => {
    expect(coverSizes(16 / 9, newsPictureSlots(3, true))).toBe('(max-width: 1023px) 94vw, 43vw');
    expect(coverSizes(16 / 9, newsPictureSlots(2, false))).toBe('(max-width: 1023px) 126vw, 47vw');
    expect(stampSizes(1)).toBe('92px');
    expect(stampSizes(16 / 9)).toBe('164px');
    expect(stampSizes(0.5)).toBe('184px');
  });
});
