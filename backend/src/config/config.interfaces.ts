import { EnvironmentEnum } from './config.enums';

export type IEnvironmentIncomingKey = keyof Environment | keyof NodeJS.ProcessEnv;
export type IEnvironmentResponseKey<T extends IEnvironmentIncomingKey> = T extends keyof Environment
  ? Environment[T]
  : NodeJS.ProcessEnv[T];

export interface IConfigService {
  get<T extends IEnvironmentIncomingKey>(env: T): IEnvironmentResponseKey<T> | undefined;
  getSafety<T extends IEnvironmentIncomingKey>(env: T): IEnvironmentResponseKey<T>;
}

export interface IConfigModuleOptions {
  isGlobal: boolean;
}

export type EnvironmentType = keyof typeof EnvironmentEnum;

/** The validated environment (see .env.example for the meaning of every variable). */
export interface Environment {
  // Environment
  NODE_ENV: EnvironmentType;

  // Application
  APP_HOST: string;
  APP_PORT: number;
  LOG_DIR?: string;

  // Postgres
  POSTGRES_NAME: string;
  POSTGRES_HOST: string;
  POSTGRES_USER: string;
  POSTGRES_PASS: string;
  POSTGRES_PORT: number;

  // S3 media storage
  S3_ENDPOINT: string;
  S3_REGION: string;
  S3_BUCKET: string;
  S3_ACCESS_KEY_ID: string;
  S3_SECRET_ACCESS_KEY: string;
  S3_FORCE_PATH_STYLE: boolean;

  // Internal API
  INTERNAL_API_KEY: string;

  // Auth
  AUTH_ACCESS_SECRET: string;
  AUTH_ACCESS_TTL: number;
  AUTH_REFRESH_TTL: number;
  ADMIN_LOGIN?: string;
  ADMIN_PASSWORD?: string;

  // Telegram
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_OWNER_ID?: string;
  TELEGRAM_DRY_RUN: boolean;

  // Leads
  IP_HASH_SALT: string;

  // Site
  SITE_URL: string;

  // Server metrics sidecar (optional; default is the Docker Compose service name)
  NODE_EXPORTER_URL?: string;
}
