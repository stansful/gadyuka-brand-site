import { env } from 'node:process';

import { DynamicModule, Module, Provider } from '@nestjs/common';

import { IConfigModuleOptions } from './config.interfaces';
import { ConfigService } from './config.service';

@Module({})
export class ConfigModule {
  static register({ isGlobal }: IConfigModuleOptions): DynamicModule {
    const configProvider: Provider = { provide: ConfigService, inject: [], useFactory: () => new ConfigService(env) };
    return {
      global: isGlobal,
      module: ConfigModule,
      providers: [configProvider],
      exports: [ConfigService],
    };
  }
}
