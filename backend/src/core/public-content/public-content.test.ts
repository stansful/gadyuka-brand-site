import { deepStrictEqual, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { OfferExpiry } from './offer-expiry';
import { TextLines } from './text-lines';

describe('TextLines (product details, one item per line)', () => {
  it('splits into trimmed, non-empty lines (LF and CRLF)', () => {
    deepStrictEqual(TextLines.split(' хлопок 100% \r\n\n  оверсайз\n \nпринт '), ['хлопок 100%', 'оверсайз', 'принт']);
    deepStrictEqual(TextLines.split(''), []);
  });
});

describe('OfferExpiry (when the visible offers change by themselves)', () => {
  const now = new Date('2026-10-16T20:00:00.000Z');
  const at = (minutes: number): Date => new Date(now.getTime() + minutes * 60_000);

  it('finds the earliest upcoming end', () => {
    deepStrictEqual(OfferExpiry.findEarliest([at(30), at(10), null, at(90)], now), at(10));
    deepStrictEqual(OfferExpiry.findEarliest([now], now), now);
  });

  it('has no end without dated offers, and ignores ends in the past', () => {
    strictEqual(OfferExpiry.findEarliest([], now), null);
    strictEqual(OfferExpiry.findEarliest([null, null], now), null);
    strictEqual(OfferExpiry.findEarliest([at(-1)], now), null);
  });
});
