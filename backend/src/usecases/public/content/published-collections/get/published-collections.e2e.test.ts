import { deepStrictEqual, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { PublishedCollectionsResponse } from '~shared/contracts/content';
import type { ApiErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { PublicContentFixtures } from '~usecases/public/content/common/test/public-content-fixtures';

import { PUBLISHED_COLLECTIONS_ROUTE } from './published-collections.route';

/** Far below anything else in a shared test database: these collections come first. */
const FIRST = -1_000_000;

describe('[e2e] GET /api/v1/public/collections', () => {
  let app: TestApp;
  let owner: TestAdmin;
  let fixtures: PublicContentFixtures;

  before(async () => {
    app = await TestApp.start();
    owner = await TestAdmin.create(app.database);
    fixtures = new PublicContentFixtures(app.database, owner.id);
  });

  after(async () => {
    await fixtures.remove();
    await owner.remove();
    await app.stop();
  });

  it('answers the slugs of the published collections in the admin order', async () => {
    const [second, first, hidden] = [fixtures.nextSlug(), fixtures.nextSlug(), fixtures.nextSlug()];
    await fixtures.createCollection({ slug: second, order: FIRST + 1, published: true });
    await fixtures.createCollection({ slug: first, order: FIRST, published: true });
    await fixtures.createCollection({ slug: hidden, order: FIRST, published: false });

    const response = await app.api.get<PublishedCollectionsResponse>(PUBLISHED_COLLECTIONS_ROUTE);
    strictEqual(response.status, 200);
    deepStrictEqual(
      response.body.slugs.filter(slug => [first, second, hidden].includes(slug)),
      [first, second],
    );
  });

  it('needs the internal key like every API route', async () => {
    const response = await app.api.withoutInternalKey().get<ApiErrorResponse>(PUBLISHED_COLLECTIONS_ROUTE);
    strictEqual(response.status, 401);
  });
});
