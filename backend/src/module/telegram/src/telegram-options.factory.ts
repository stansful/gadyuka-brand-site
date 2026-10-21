import { ConfigService, EnvironmentEnum } from '~config';

import { TelegramOptions } from './telegram.interfaces';

/** TelegramOptions from the environment (TELEGRAM_*, SITE_URL, NODE_ENV). */
export class TelegramOptionsFactory {
  static fromConfig(config: ConfigService): TelegramOptions {
    return {
      token: config.get('TELEGRAM_BOT_TOKEN') ?? '',
      chatId: config.get('TELEGRAM_OWNER_ID') ?? '',
      dryRun: config.getSafety('TELEGRAM_DRY_RUN'),
      siteUrl: config.getSafety('SITE_URL').replace(/\/+$/, ''),
      isProduction: config.getSafety('NODE_ENV') === EnvironmentEnum.prod,
    };
  }
}
