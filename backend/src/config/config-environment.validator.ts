import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { EnvironmentEnum } from './config.enums';
import { Environment, EnvironmentType } from './config.interfaces';
import { EnvironmentValue } from './environment-value';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;
/** Shortest access token lifetime: a token must outlive a request or two. */
const MIN_ACCESS_TTL_SECONDS = SECONDS_PER_MINUTE;
/** Longest refresh token lifetime: a forgotten session ends within a quarter. */
const MAX_REFRESH_TTL_DAYS = 90;
const MAX_PORT = 65535;
/** Secrets shared with other services or signing tokens. */
const MIN_SECRET_LENGTH = 32;
const MIN_SALT_LENGTH = 16;
const MIN_ADMIN_PASSWORD_LENGTH = 16;
const MAX_ADMIN_PASSWORD_LENGTH = 256;
/** Same rule as the users_login_check constraint. */
const LOGIN_PATTERN = /^[a-z0-9._@-]{3,64}$/;
/** S3 bucket naming rules (lowercase, digits, dots, hyphens; 3–63 characters). */
const BUCKET_PATTERN = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const HTTP_URL = { protocols: ['http', 'https'], require_protocol: true, require_tld: false };

export class ConfigEnvironmentValidator implements Environment {
  // Environment
  @IsEnum(EnvironmentEnum)
  NODE_ENV: EnvironmentType;

  // Application
  @IsString()
  @IsNotEmpty()
  APP_HOST: string;
  @IsInt()
  @Min(0)
  @Max(MAX_PORT)
  @Transform(({ value }) => EnvironmentValue.toInteger(value), { toClassOnly: true })
  APP_PORT: number;
  @IsOptional()
  @IsString()
  @Transform(({ value }) => EnvironmentValue.toOptional(value), { toClassOnly: true })
  LOG_DIR?: string;

  // Postgres
  @IsString()
  @IsNotEmpty()
  POSTGRES_NAME: string;
  @IsString()
  @IsNotEmpty()
  POSTGRES_HOST: string;
  @IsString()
  @IsNotEmpty()
  POSTGRES_USER: string;
  @IsString()
  @IsNotEmpty()
  POSTGRES_PASS: string;
  @IsInt()
  @Min(1)
  @Max(MAX_PORT)
  @Transform(({ value }) => EnvironmentValue.toInteger(value), { toClassOnly: true })
  POSTGRES_PORT: number;

  // S3 media storage
  @IsUrl(HTTP_URL)
  S3_ENDPOINT: string;
  @IsString()
  @Transform(({ value }) => EnvironmentValue.toText(value, 'us-east-1'), { toClassOnly: true })
  S3_REGION: string;
  @Matches(BUCKET_PATTERN)
  S3_BUCKET: string;
  @IsString()
  @IsNotEmpty()
  S3_ACCESS_KEY_ID: string;
  @IsString()
  @IsNotEmpty()
  S3_SECRET_ACCESS_KEY: string;
  @IsBoolean()
  @Transform(({ value }) => EnvironmentValue.toFlagDefaultingToTrue(value), { toClassOnly: true })
  S3_FORCE_PATH_STYLE: boolean;

  // Internal API
  @IsString()
  @MinLength(MIN_SECRET_LENGTH)
  INTERNAL_API_KEY: string;

  // Auth
  @IsString()
  @MinLength(MIN_SECRET_LENGTH)
  AUTH_ACCESS_SECRET: string;
  @IsInt()
  @Min(MIN_ACCESS_TTL_SECONDS)
  @Max(SECONDS_PER_HOUR)
  @Transform(({ value }) => EnvironmentValue.toInteger(value), { toClassOnly: true })
  AUTH_ACCESS_TTL: number;
  @IsInt()
  @Min(SECONDS_PER_HOUR)
  @Max(MAX_REFRESH_TTL_DAYS * SECONDS_PER_DAY)
  @Transform(({ value }) => EnvironmentValue.toInteger(value), { toClassOnly: true })
  AUTH_REFRESH_TTL: number;
  @IsOptional()
  @Matches(LOGIN_PATTERN)
  @Transform(({ value }) => EnvironmentValue.toOptional(value), { toClassOnly: true })
  ADMIN_LOGIN?: string;
  @IsOptional()
  @IsString()
  @MinLength(MIN_ADMIN_PASSWORD_LENGTH)
  @MaxLength(MAX_ADMIN_PASSWORD_LENGTH)
  @Transform(({ value }) => EnvironmentValue.toOptional(value), { toClassOnly: true })
  ADMIN_PASSWORD?: string;

  // Telegram
  @IsOptional()
  @IsString()
  @Transform(({ value }) => EnvironmentValue.toOptional(value), { toClassOnly: true })
  TELEGRAM_BOT_TOKEN?: string;
  @IsOptional()
  @IsString()
  @Transform(({ value }) => EnvironmentValue.toOptional(value), { toClassOnly: true })
  TELEGRAM_OWNER_ID?: string;
  @IsBoolean()
  @Transform(({ value }) => EnvironmentValue.toFlagDefaultingToFalse(value), { toClassOnly: true })
  TELEGRAM_DRY_RUN: boolean;

  // Leads
  /** Trimmed BEFORE the length check: the value checked is exactly the HMAC key VisitorNetworkHasher uses. */
  @IsString()
  @MinLength(MIN_SALT_LENGTH)
  @Transform(({ value }) => EnvironmentValue.toOptional(value), { toClassOnly: true })
  IP_HASH_SALT: string;

  // Site
  @IsUrl(HTTP_URL)
  SITE_URL: string;
}
