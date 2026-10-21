import { Logger } from '@nestjs/common';

import { AppFactory } from './app.factory';
import { ConfigService } from './config';

class Application {
  private static readonly logger = new Logger(Application.name);

  static async start(): Promise<void> {
    const app = await AppFactory.create();
    const config = app.get(ConfigService);
    await app.listen(config.getSafety('APP_PORT'), config.getSafety('APP_HOST'));
    Application.logger.log('Application : listening', { url: await app.getUrl() });
  }
}

void Application.start();
