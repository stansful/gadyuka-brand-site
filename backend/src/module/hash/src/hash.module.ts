import { DynamicModule, FactoryProvider, Module, Provider } from '@nestjs/common';

import { HASH, HASH_OPTIONS } from './hash.constants';
import { IHashOptions } from './hash.interface';
import { HashService } from './hash.service';

@Module({})
export class HashModule {
  static register(options: Omit<FactoryProvider<Promise<IHashOptions> | IHashOptions>, 'provide'>): DynamicModule {
    return {
      module: HashModule,
      providers: [HashModule.optionsProvider(options), HashModule.hashProvider()],
      exports: [HASH],
    };
  }

  private static optionsProvider(
    options: Omit<FactoryProvider<Promise<IHashOptions> | IHashOptions>, 'provide'>,
  ): Provider {
    return { provide: HASH_OPTIONS, inject: options.inject || [], useFactory: options.useFactory };
  }

  private static hashProvider(): Provider {
    return {
      provide: HASH,
      inject: [HASH_OPTIONS],
      useFactory: (hashOptions: IHashOptions) => new HashService(hashOptions),
    };
  }
}
