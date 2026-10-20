import type { Locale } from '@/i18n/locales';
import { type ChapterId, chapterNumber, type LandingContent, type TextKey } from '@/lib/content';

import type { ReactElement } from 'react';

import { formatNodes, formatText } from '../message-template';
import { RichText } from '../RichText';

/**
 * Shared pieces of the comic chapters (server components).
 * Chapter numbers come from CHAPTER_ORDER (src/lib/content/registry.ts), so labels, folios
 * and the menu always follow the actual order of the sections.
 */

type Texts = LandingContent['texts'];

/**
 * «Глава 02 · О нас» — the messages common.chapterNo («Глава {number}», the number derived
 * from the order) and, with a suffix, common.chapterLabel («{chapter} · {label}»).
 */
export function ChapterLabel({
  chapter,
  texts,
  locale,
  suffixKey,
}: {
  chapter: ChapterId;
  texts: Texts;
  locale: Locale;
  suffixKey?: TextKey;
}): ReactElement {
  const suffix = suffixKey ? texts[suffixKey] : '';
  const number = (
    <span data-edit="common.chapterNo">
      {formatText(texts['common.chapterNo'], locale, { number: chapterNumber(chapter) })}
    </span>
  );
  if (!suffix || !suffixKey) return <span>{number}</span>;
  return (
    <span data-edit="common.chapterLabel">
      {formatNodes(texts['common.chapterLabel'], locale, {
        chapter: number,
        label: <span data-edit={suffixKey}>{suffix}</span>,
      })}
    </span>
  );
}

type ChapterHeaderProps = {
  chapter: ChapterId;
  texts: Texts;
  locale: Locale;
  titleKey: TextKey;
  narrationKey: TextKey;
  suffixKey?: TextKey;
  headingId: string;
};

/** Chapter opening: «Глава NN», the inked title (with the hatched offset shadow), the narration plate. */
export function ChapterHeader({
  chapter,
  texts,
  locale,
  titleKey,
  narrationKey,
  suffixKey,
  headingId,
}: ChapterHeaderProps): ReactElement {
  const title = texts[titleKey];
  const narration = texts[narrationKey];
  return (
    <header className="chapter">
      <span className="chapter__sheet" aria-hidden="true" />
      <p className="chapter__no">
        <ChapterLabel chapter={chapter} texts={texts} locale={locale} suffixKey={suffixKey} />
      </p>
      <h2 className="chapter__title" id={headingId} data-edit={titleKey} data-text={title}>
        {title}
      </h2>
      {narration ? (
        <p className="caption caption--paper chapter__cap" data-edit={narrationKey}>
          {narration}
        </p>
      ) : null}
    </header>
  );
}

/** «— 02 —» at the bottom of a chapter page (an aria-hidden ornament: no copy, nothing to translate). */
export function Folio({ chapter, paper = false }: { chapter: ChapterId; paper?: boolean }): ReactElement {
  return (
    <span className={paper ? 'folio folio--paper' : 'folio'} aria-hidden="true">
      — {chapterNumber(chapter)} —
    </span>
  );
}

const ARROWS = /([←→])/;

/**
 * Message text with its arrows (← →) set in the system UI face, as in the concept: Tektur has no
 * arrows, and next/font's metric-adjusted Arial fallback would draw thin, long ones.
 */
export function WithGlyphs({ text }: { text: string }): ReactElement {
  return (
    <>
      {text.split(ARROWS).map((part, index) =>
        ARROWS.test(part) ? (
          <span key={index} className="glyph">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

/**
 * Designed empty state: a dashed, inked frame (with an aria-hidden «?» ornament) and a
 * hand-lettered message. Rendered as RichText, so a richtext message (news.text) keeps the
 * paragraphs the admin separated.
 */
export function EmptyState({ text, editKey }: { text: string; editKey: TextKey }): ReactElement {
  return (
    <div className="empty">
      <span className="empty__mark" aria-hidden="true">
        ?
      </span>
      <RichText text={text} editKey={editKey} className="empty__text" />
    </div>
  );
}
