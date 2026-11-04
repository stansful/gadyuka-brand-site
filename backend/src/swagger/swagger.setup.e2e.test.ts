import { deepStrictEqual, ok } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import { ModulesContainer } from '@nestjs/core';
import { NestNodeApplication } from '@nestjs/platform-node';
import { OpenAPIObject } from '@nestjs/swagger';

import { ApiRoute, RouteInventory } from '~test/e2e/route-inventory';

import { AppFactory } from '../app.factory';
import { SwaggerSetup } from './swagger.setup';

/**
 * The dev Swagger document describes EVERY route of the app — the slice modules imported by the group
 * modules too (AdminModule → CatalogModule …), which `include` + `deepScanRoutes` used to miss.
 */
describe('[e2e] Swagger document of the app', () => {
  const PATH_PARAMETER = /:([A-Za-z0-9_]+)/g;
  let app: NestNodeApplication;
  let document: OpenAPIObject;
  let routes: ApiRoute[];

  before(async () => {
    app = await AppFactory.create();
    document = new SwaggerSetup().createDocument(app);
    routes = new RouteInventory(app.get(ModulesContainer)).list();
  });

  after(async () => {
    await app.close();
  });

  function documentedOperations(): Set<string> {
    return new Set(
      Object.entries(document.paths).flatMap(([path, item]) =>
        Object.keys(item).map(method => `${method.toUpperCase()} ${path}`),
      ),
    );
  }

  it('describes every API route, the slice routes included', () => {
    const documented = documentedOperations();
    const apiRoutes = routes.filter(route => route.path.startsWith('/api/'));
    ok(apiRoutes.length > 60, `${apiRoutes.length} routes`);
    const missing = apiRoutes
      .map(route => `${route.method} ${route.path.replace(PATH_PARAMETER, '{$1}')}`)
      .filter(operation => !documented.has(operation));
    deepStrictEqual(missing, []);
  });

  it('shares one MediaRef schema between the admin areas', () => {
    ok(document.components?.schemas?.MediaRefResponse !== undefined);
  });
});
