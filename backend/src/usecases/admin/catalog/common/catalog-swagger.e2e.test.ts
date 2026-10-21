import { deepStrictEqual, ok } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

import { CatalogModule } from '~usecases/admin/catalog/catalog.module';

import { AppFactory } from '../../../../app.factory';

/**
 * The Swagger document of the catalog routes builds (Swagger runs only with NODE_ENV=dev, so a broken
 * schema — e.g. a runtime-built DTO without property types — would show up only there).
 */
describe('[e2e] Swagger document of the catalog routes', () => {
  let app: NestFastifyApplication;
  let document: OpenAPIObject;

  before(async () => {
    app = await AppFactory.create();
    document = SwaggerModule.createDocument(app, new DocumentBuilder().build(), { include: [CatalogModule] });
  });

  after(async () => {
    await app.close();
  });

  it('describes every catalog route', () => {
    deepStrictEqual(Object.keys(document.paths).sort(), [
      '/api/v1/admin/collections',
      '/api/v1/admin/collections/{id}',
      '/api/v1/admin/products',
      '/api/v1/admin/products/{id}',
      '/api/v1/admin/reviews',
      '/api/v1/admin/reviews/rating-scale',
      '/api/v1/admin/reviews/{id}',
      '/api/v1/admin/settings',
    ]);
  });

  it('types the translations of the LocalizedText fields', () => {
    const schema = document.components?.schemas?.LocalizedTextRequired200;
    ok(schema !== undefined && 'properties' in schema);
    deepStrictEqual(schema.required, ['ru']);
    deepStrictEqual(schema.properties?.en, { type: 'string', maxLength: 200 });
  });
});
