import { DynamicModule, Module } from '@nestjs/common';

import { DatabaseModuleOptions } from './database.interfaces';
import { DatabaseService } from './database.service';

@Module({})
export class DatabaseModule {
  static register({ isGlobal }: DatabaseModuleOptions): DynamicModule {
    return {
      global: isGlobal,
      module: DatabaseModule,
      providers: [DatabaseService],
      exports: [DatabaseService],
    };
  }
}
