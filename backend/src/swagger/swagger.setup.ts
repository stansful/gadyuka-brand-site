import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

import { RequestHeader } from '~core/constants/request-header.enum';
import { API_VERSION } from '~usecases/usecase.interfaces';

/** Swagger UI at /api/v1/swagger — only with NODE_ENV=dev (main.ts / AppFactory). */
export class SwaggerSetup {
  static readonly PATH = `${API_VERSION}/swagger`;
  private static readonly INTERNAL_KEY_SCHEME = 'internal-key';

  setup(app: INestApplication): void {
    SwaggerModule.setup(SwaggerSetup.PATH, app, this.createDocument(app));
  }

  /**
   * The document of EVERY route of the app: all modules are scanned (no `include`), so the slice modules
   * that the group modules import (AdminModule → CatalogModule …) are described too — `include` +
   * `deepScanRoutes` reach only one level below the included module (src/swagger/swagger.setup.e2e.test.ts).
   */
  createDocument(app: INestApplication): OpenAPIObject {
    return SwaggerModule.createDocument(app, this.buildConfig());
  }

  private buildConfig(): ReturnType<DocumentBuilder['build']> {
    return new DocumentBuilder()
      .setTitle('ГАДЮКА backend')
      .setDescription('Внутренний API сайта: его вызывает только сервер Next.js (заголовок x-internal-key).')
      .addApiKey({ type: 'apiKey', in: 'header', name: RequestHeader.INTERNAL_KEY }, SwaggerSetup.INTERNAL_KEY_SCHEME)
      .addSecurityRequirements(SwaggerSetup.INTERNAL_KEY_SCHEME)
      .addBearerAuth()
      .addTag('public', 'Публичные данные сайта (без входа)')
      .addTag('auth', 'Вход в админку: сессии и токены')
      .addTag('admin', 'Админка (роль ADMIN)')
      .build();
  }
}
