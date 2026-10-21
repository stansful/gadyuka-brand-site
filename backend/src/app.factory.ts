import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

import { MAX_MEDIA_KEY_LENGTH } from '~core/media/media.constants';
import { AppLogger } from '~module/logger';
import { SwaggerSetup } from '~swagger/swagger.setup';

import { AppModule } from './app.module';
import { ConfigService, EnvironmentEnum } from './config';

/** Builds the application exactly as it runs (main.ts) — also used by the e2e tests. */
export class AppFactory {
  static async create(): Promise<NestFastifyApplication> {
    const app = await NestFactory.create<NestFastifyApplication>(AppModule, AppFactory.createAdapter(), {
      bufferLogs: true,
    });
    app.useLogger(app.get(AppLogger));
    app.enableShutdownHooks();
    AppFactory.setupSwaggerInDevelopment(app);
    return app;
  }

  private static createAdapter(): FastifyAdapter {
    // Behind the Next.js server only: the visitor's IP comes in x-client-ip, not X-Forwarded-For.
    return new FastifyAdapter({ trustProxy: false, routerOptions: { maxParamLength: MAX_MEDIA_KEY_LENGTH } });
  }

  private static setupSwaggerInDevelopment(app: NestFastifyApplication): void {
    if (app.get(ConfigService).getSafety('NODE_ENV') === EnvironmentEnum.dev) {
      new SwaggerSetup().setup(app);
    }
  }
}
