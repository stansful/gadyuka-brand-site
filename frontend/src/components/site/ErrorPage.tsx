import type { ReactElement, ReactNode } from 'react';

import { ScrollSpine } from './chrome/ScrollSpine';

type ErrorPageProps = {
  kicker: string;
  title: string;
  caption: string;
  text: string;
  /** Big outlined mark in the side panel ("404"). */
  mark: string;
  action: ReactNode;
  homeHref: string;
  /** Accessible name of the logo link. */
  homeLabel: string;
};

/**
 * Error / not-found page in the noir-comic language: a minimal masthead with the logo, a chapter
 * opening («Ошибка 404», inked title, narration plate) and an ink panel with the way back.
 * Static markup (works from both the server not-found and the client error boundary) + the scroll
 * snake, the scrollbar of every public page (noir.css hides the native one).
 */
export function ErrorPage({
  kicker,
  title,
  caption,
  text,
  mark,
  action,
  homeHref,
  homeLabel,
}: ErrorPageProps): ReactElement {
  return (
    <>
      <ScrollSpine />
      <header className="hdr is-solid">
        <div className="hdr__in">
          <a className="hdr__logo" href={homeHref} aria-label={homeLabel}>
            <span className="hdr__mark mask-img m-logo" aria-hidden="true" />
            <span className="hdr__word mask-img m-wordmark" aria-hidden="true" />
          </a>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="page page--error">
        <div className="wrap">
          <header className="chapter">
            <p className="chapter__no">
              <span>{kicker}</span>
            </p>
            <h1 className="chapter__title" data-text={title}>
              {title}
            </h1>
            {caption ? <p className="caption caption--paper chapter__cap">{caption}</p> : null}
          </header>
          <div className="grid">
            <div className="panel panel--ink err-panel dots">
              <p className="lead">{text}</p>
              <div className="err-actions">{action}</div>
            </div>
            <div className="panel panel--ink err-mark hatch" aria-hidden="true">
              <span className="err-mark__no">{mark}</span>
              <span className="err-mark__art mask-img m-head-front" />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
