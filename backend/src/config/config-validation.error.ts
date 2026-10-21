import { ValidationError } from 'class-validator';

/**
 * Invalid environment. The message names the variables and the failed rules, never the values
 * (they are secrets).
 */
export class ConfigValidationError extends Error {
  constructor(errors: readonly ValidationError[]) {
    super(`Invalid environment (see .env.example): ${ConfigValidationError.describe(errors)}`);
    this.name = 'ConfigValidationError';
  }

  private static describe(errors: readonly ValidationError[]): string {
    return errors.map(error => `${error.property} (${Object.keys(error.constraints ?? {}).join(', ')})`).join('; ');
  }
}
