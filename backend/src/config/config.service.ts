import { Injectable } from '@nestjs/common';

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ConfigEnvironmentValidator } from './config-environment.validator';
import { ConfigValidationError } from './config-validation.error';
import { Environment, IConfigService, IEnvironmentIncomingKey, IEnvironmentResponseKey } from './config.interfaces';

/** The validated environment. Created once (ConfigModule) from process.env; invalid → the app does not start. */
@Injectable()
export class ConfigService implements IConfigService {
  private readonly props: Environment & NodeJS.ProcessEnv;

  constructor(env: NodeJS.ProcessEnv) {
    const validatedConfig = plainToInstance(ConfigEnvironmentValidator, env);
    const errors = validateSync(validatedConfig, { skipMissingProperties: false });
    if (errors.length > 0) {
      throw new ConfigValidationError(errors);
    }
    // plainToInstance keeps every variable of `env`, the declared ones converted and validated.
    this.props = validatedConfig as Environment & NodeJS.ProcessEnv;
  }

  get<T extends IEnvironmentIncomingKey>(env: T): IEnvironmentResponseKey<T> | undefined {
    return this.getKey(env);
  }

  getSafety<T extends IEnvironmentIncomingKey>(env: T): IEnvironmentResponseKey<T> {
    const key = this.getKey(env);
    if (key === undefined) {
      throw new Error(`Cannot get env key: ${env}`);
    }
    return key;
  }

  private getKey<T extends IEnvironmentIncomingKey>(key: T): IEnvironmentResponseKey<T> | undefined {
    return this.props[key] as IEnvironmentResponseKey<T> | undefined;
  }
}
