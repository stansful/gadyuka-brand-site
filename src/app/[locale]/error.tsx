"use client";

import { useParams } from "next/navigation";
import { useEffect, type ReactElement } from "react";
import { toLocale } from "@/i18n/locales";
import { localizedPath } from "@/lib/seo/site-url";
import { ERROR_COPY } from "@/components/site/error-copy";
import { ErrorPage } from "@/components/site/ErrorPage";

export default function LocaleError({ error, retry }: { error: unknown; retry: () => void }): ReactElement {
  const params = useParams<{ locale?: string }>();
  const locale = toLocale(params.locale);
  const copy = ERROR_COPY[locale];
  const home = localizedPath(locale, "/");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorPage
      homeHref={home}
      homeLabel={copy.homeLink}
      kicker={copy.kicker}
      title={copy.title}
      caption={copy.caption}
      text={copy.text}
      mark="!?"
      action={
        <>
          <button type="button" className="btn btn--red" onClick={() => retry()}>
            <span className="btn__face">{copy.retry}</span>
          </button>
          <a className="link-btn err-home" href={home}>
            {copy.backHome} <span className="glyph" aria-hidden="true">→</span>
          </a>
        </>
      }
    />
  );
}
