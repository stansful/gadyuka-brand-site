import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import { MODULE_METADATA } from '@nestjs/common/constants';

import type { ApiErrorResponse } from '~shared/contracts/errors';

import { MEDIA_URL_PREFIX } from '~core/media/media.constants';
import { UserRole } from '~core/users/user-role';
import { NoInternalKey, Public, Roles } from '~decorator';
import { ApiRoute, RouteInventory } from '~test/e2e/route-inventory';
import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { AdminModule } from '~usecases/admin/admin.module';
import { LOGIN_ROUTE } from '~usecases/auth/login/post/login.route';
import { LOGOUT_ROUTE } from '~usecases/auth/logout/post/logout.route';
import { REFRESH_ROUTE } from '~usecases/auth/refresh/post/refresh.route';
import { MEDIA_ROUTE } from '~usecases/public/media/get/media.route';
import { API_VERSION } from '~usecases/usecase.interfaces';

/**
 * Access rules checked for EVERY route of the app (also the ones added later):
 * - only GET|HEAD /media/* works without x-internal-key;
 * - @Public() only under /api/v1/public/*, /media/* and the sign-in routes (login, refresh, logout);
 * - every admin route (AdminModule and the slice modules it imports, /api/v1/admin/*) needs a
 *   signed-in ADMIN: declared with @Roles([ADMIN]), and answered 401 without a session / 403 to a USER.
 */
describe('[e2e] route access policy (every route of the app)', () => {
  const SIGN_IN_ROUTES: readonly string[] = [LOGIN_ROUTE, REFRESH_ROUTE, LOGOUT_ROUTE];
  const PUBLIC_PREFIXES: readonly string[] = [`${API_VERSION}/public/`, `${MEDIA_URL_PREFIX}/`];
  /** AdminModule and the slice modules it imports (their routes are admin routes whatever the path). */
  const ADMIN_MODULES: ReadonlySet<string> = new Set([
    AdminModule.name,
    ...(Reflect.getMetadata(MODULE_METADATA.IMPORTS, AdminModule) as Array<{ name: string }>).map(
      module => module.name,
    ),
  ]);
  let app: TestApp;
  let inventory: RouteInventory;
  let routes: ApiRoute[];

  before(async () => {
    app = await TestApp.start();
    inventory = new RouteInventory(app.modules);
    routes = inventory.list();
  });

  after(async () => {
    await app.stop();
  });

  function describeRoute(route: ApiRoute): string {
    return `${route.method} ${route.path}`;
  }

  function adminRoutes(): ApiRoute[] {
    return routes.filter(route => ADMIN_MODULES.has(route.module) || route.path.startsWith(`${API_VERSION}/admin`));
  }

  it('finds the routes of the app', () => {
    for (const path of [LOGIN_ROUTE, MEDIA_ROUTE]) {
      ok(
        routes.some(route => route.path === path),
        path,
      );
    }
  });

  it('exempts only GET /media/* from the internal key', () => {
    const exempt = routes.filter(route => inventory.metadataOf(NoInternalKey, route) === true);
    deepStrictEqual(exempt.map(describeRoute), [`GET ${MEDIA_ROUTE}`]);
  });

  it('answers 401 internalKeyRequired without the key on every other route', async () => {
    for (const route of routes.filter(candidate => candidate.path !== MEDIA_ROUTE)) {
      const response = await app.api
        .withoutInternalKey()
        .request<ApiErrorResponse>(route.method, inventory.samplePathOf(route));
      strictEqual(response.status, 401, describeRoute(route));
      strictEqual(response.body.error, 'internalKeyRequired', describeRoute(route));
    }
  });

  it('keeps @Public() to the public API, the media files and the sign-in routes', () => {
    for (const route of routes.filter(candidate => inventory.metadataOf(Public, candidate) === true)) {
      const isAllowed =
        SIGN_IN_ROUTES.includes(route.path) || PUBLIC_PREFIXES.some(prefix => route.path.startsWith(prefix));
      ok(isAllowed, `${describeRoute(route)} is @Public() outside the public routes`);
    }
  });

  it('finds the admin routes of the slice modules', () => {
    ok(ADMIN_MODULES.size > 1, 'AdminModule imports the slice modules');
    ok(adminRoutes().length > 0, 'admin routes');
  });

  it('lets only a signed-in ADMIN reach an admin route', () => {
    for (const route of adminRoutes()) {
      strictEqual(inventory.metadataOf(Public, route), undefined, `${describeRoute(route)} is @Public()`);
      deepStrictEqual(inventory.metadataOf(Roles, route), [UserRole.ADMIN], `${describeRoute(route)} lacks @Roles`);
    }
  });

  it('answers 401 without a session and 403 to a signed-in USER on every admin route', async () => {
    const user = await TestAdmin.createWithRole(app.database, UserRole.USER);
    try {
      const accessToken = await user.signIn(app.api);
      for (const route of adminRoutes()) {
        const path = inventory.samplePathOf(route);
        const anonymous = await app.api.request<ApiErrorResponse>(route.method, path);
        strictEqual(anonymous.status, 401, describeRoute(route));
        const signedIn = await app.api.request<ApiErrorResponse>(route.method, path, { accessToken });
        deepStrictEqual([signedIn.status, signedIn.body.error], [403, 'forbidden'], describeRoute(route));
      }
    } finally {
      await user.remove();
    }
  });
});
