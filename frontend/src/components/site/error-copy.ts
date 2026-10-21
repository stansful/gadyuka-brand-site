import type { SiteMessages } from '@/i18n/messages';

/**
 * Copy of the error boundary (src/app/[locale]/error.tsx). The client-side error page can
 * neither read the database nor ask next-intl, and bundling shared/messages/*.json into it would ship
 * every site message to the browser — so the server layout resolves this copy from the
 * DB-backed messages (getSiteMessages: admin edits included) and hands it down through
 * <ErrorCopyProvider> (./ErrorCopyProvider.tsx): a few hundred bytes per page.
 * One source per string: error.*, common.backHome (shared with the 404 page), common.homeLink.
 */
export type ErrorCopy = {
  kicker: string;
  title: string;
  caption: string;
  text: string;
  /** The big outlined mark of the side panel («!?»). */
  mark: string;
  retry: string;
  backHome: string;
  homeLink: string;
};

export function errorCopyFromMessages(messages: SiteMessages): ErrorCopy {
  return {
    kicker: messages.error.kicker,
    title: messages.error.title,
    caption: messages.error.caption,
    text: messages.error.text,
    mark: messages.error.mark,
    retry: messages.error.retry,
    backHome: messages.common.backHome,
    homeLink: messages.common.homeLink,
  };
}
