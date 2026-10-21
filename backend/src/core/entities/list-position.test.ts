import { ok, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { ListPosition } from './list-position';

describe('ListPosition', () => {
  it('puts a new row last (0 in an empty list)', () => {
    strictEqual(ListPosition.after(null), 0);
    strictEqual(ListPosition.after(0), 1);
    strictEqual(ListPosition.after(7), 8);
  });

  it('keeps the position of a product only within its collection', () => {
    ok(ListPosition.isKeptOnMove('a', 'a'));
    ok(!ListPosition.isKeptOnMove('a', 'b'));
  });
});
