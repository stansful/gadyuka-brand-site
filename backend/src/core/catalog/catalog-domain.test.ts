import { ok } from 'node:assert';
import { describe, it } from 'node:test';

import { SlugOwnership } from './slug-ownership';

describe('SlugOwnership', () => {
  it('lets a row keep its own slug and take a free one, refuses another row’s', () => {
    ok(!new SlugOwnership(null).isTakenByAnother());
    ok(!new SlugOwnership('row-1', 'row-1').isTakenByAnother());
    ok(new SlugOwnership('row-1').isTakenByAnother());
    ok(new SlugOwnership('row-1', 'row-2').isTakenByAnother());
  });
});
