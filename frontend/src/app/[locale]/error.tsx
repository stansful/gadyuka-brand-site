'use client';

import { useParams } from 'next/navigation';
import { useEffect, type ReactElement } from 'react';

import { useErrorCopy } from '@/components/site/ErrorCopyProvider';
import { ErrorPage } from '@/components/site/ErrorPage';
import { toLocale } from '@/i18n/locales';
import { localizedPath } from '@/lib/seo/site-url';

/**
 * Error boundary of the public pages. A client component: its copy (messages error.*,
 * common.backHome, common.homeLink — editable in the admin) is resolved by the [locale] layout
 * on the server and read from <ErrorCopyProvider> (src/components/site/error-copy.ts).
 */
export default function LocaleError({ error, retry }: { error: unknown; retry: () => void }): ReactElement {
  const params = useParams<{ locale?: string }>();
  const home = localizedPath(toLocale(params.locale), '/');
  const copy = useErrorCopy();

  useEffect(() => {
    console.error(error);
  }, [error]);

  // The layout always provides the copy (this boundary renders inside it); without it there is
  // nothing to say — leave the error to the next boundary up.
  if (!copy) throw error;

  return (
    <ErrorPage
      homeHref={home}
      homeLabel={copy.homeLink}
      kicker={copy.kicker}
      title={copy.title}
      caption={copy.caption}
      text={copy.text}
      mark={copy.mark}
      action={
        <>
          <button type="button" className="btn btn--red" onClick={() => retry()}>
            <span className="btn__face">{copy.retry}</span>
          </button>
          <a className="link-btn err-home" href={home}>
            {copy.backHome}{' '}
            <span className="glyph" aria-hidden="true">
              →
            </span>
          </a>
        </>
      }
    />
  );
}
