import type { Locale } from "@/i18n/locales";

/**
 * Copy of the error boundary (src/app/[locale]/error.tsx) — the client-side error page cannot
 * ask the server for it and the public pages ship no message catalogue. Mirrors
 * messages/*.json (error.*, notFound.backHome, common.homeLink); error-copy.test.ts keeps the
 * two in sync.
 */
export type ErrorCopy = {
  kicker: string;
  title: string;
  caption: string;
  text: string;
  retry: string;
  backHome: string;
  homeLink: string;
};

export const ERROR_COPY: Readonly<Record<Locale, ErrorCopy>> = {
  ru: {
    kicker: "Ошибка",
    title: "Что-то пошло не так",
    caption: "Сбой в типографии.",
    text: "Мы уже разбираемся. Попробуйте обновить страницу.",
    retry: "Попробовать снова",
    backHome: "На главную",
    homeLink: "ГАДЮКА — на главную",
  },
  en: {
    kicker: "Error",
    title: "Something went wrong",
    caption: "Trouble at the printing press.",
    text: "We're on it. Please try reloading the page.",
    retry: "Try again",
    backHome: "Back to home",
    homeLink: "GADYUKA — home",
  },
};
