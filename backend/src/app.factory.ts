import { NestFactory } from '@nestjs/core';
import { NestNodeApplication, NodeAdapter } from '@nestjs/platform-node';

import { MAX_MEDIA_KEY_LENGTH } from '~core/media/media.constants';
import { AppLogger } from '~module/logger';
import { SwaggerSetup } from '~swagger/swagger.setup';

import { AppModule } from './app.module';
import { ConfigService, EnvironmentEnum } from './config';

/** Builds the application exactly as it runs (main.ts) — also used by the e2e tests. */
export class AppFactory {
  static async create(): Promise<NestNodeApplication> {
    const app = await NestFactory.create<NestNodeApplication>(AppModule, AppFactory.createAdapter(), {
      bufferLogs: true,
    });
    app.useLogger(app.get(AppLogger));
    app.enableShutdownHooks();
    AppFactory.setupSwaggerInDevelopment(app);
    return app;
  }

  private static createAdapter(): NodeAdapter {
    // Behind the Next.js server only: the visitor's IP comes in x-client-ip, not X-Forwarded-For.
    return new NodeAdapter({ trustProxy: false, maxParamLength: MAX_MEDIA_KEY_LENGTH });
  }

  private static setupSwaggerInDevelopment(app: NestNodeApplication): void {
    if (app.get(ConfigService).getSafety('NODE_ENV') === EnvironmentEnum.dev) {
      new SwaggerSetup().setup(app);
    }
  }
}
