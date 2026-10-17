"use client";

import type { MouseEvent, ReactElement } from "react";
import { SECTION_ANCHORS } from "@/lib/content/anchors";
import type { LanguageSwitcherProps } from "./labels";
import { currentSectionId, fragmentId, withSectionHash } from "./locale-switch";

/** Same reading line as the menu highlight (HeaderClient: rootMargin -45 % from the top). */
const READING_LINE = 0.45;

/**
 * The anchor of where the reader is now: on the landing — the chapter crossing the reading
 * line (the cover → none); on other pages (no chapters) — the current #hash, if any.
 */
function readerAnchor(): string | null {
  const sections = Array.from(document.querySelectorAll<HTMLElement>("main > section[id]"), (el) => ({
    id: el.id,
    top: el.getBoundingClientRect().top,
  }));
  if (sections.length === 0) return fragmentId(window.location.hash);
  return currentSectionId(sections, window.innerHeight * READING_LINE);
}

/**
 * Switches the current page to another locale (keeps the path, "/" ↔ "/en", and the chapter
 * the reader is in: "/#reviews" → "/en#reviews").
 *
 * The href follows the as-needed prefix rules (ru → "/…", en → "/en/…"), i.e. it is the
 * same canonical URL as in hreflang — NOT next-intl's <Link locale>, which forces a "/ru"
 * prefix that the proxy then 307-redirects back to "/". A plain <a>: switching the locale
 * changes the root layout param (<html lang>), which is a full document navigation anyway.
 * Without JS (or with a modifier key) the link opens the other language at the top.
 * The hrefs (localizedPath of the current page) and the copy come from the server (SiteHeader).
 */
export function LanguageSwitcher({ label, options, switchBefore, switchAfter }: LanguageSwitcherProps): ReactElement {
  const onSwitch = (event: MouseEvent<HTMLAnchorElement>): void => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const href = event.currentTarget.getAttribute("href");
    if (!href) return;
    const target = withSectionHash(href, readerAnchor(), SECTION_ANCHORS.hero);
    if (target === href) return;
    event.preventDefault();
    window.location.assign(target);
  };

  return (
    <nav className="lang" aria-label={label}>
      <ul>
        {options.map(({ locale, short, native, href, current }) => (
          <li key={locale}>
            {current ? (
              <span aria-current="true" lang={locale} title={native}>
                {short}
              </span>
            ) : (
              // No `lang` on the link: its name is a sentence in the page's language; only the
              // language's own name inside it is marked up in that language.
              <a href={href} hrefLang={locale} onClick={onSwitch}>
                {short}
                <span className="sr-only">
                  {" — "}
                  {switchBefore}
                  <span lang={locale}>{native}</span>
                  {switchAfter}
                </span>
              </a>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
