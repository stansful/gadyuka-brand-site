import type { Locale } from './locales';
import type { Messages } from './request';

declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
