import type { ReactElement } from "react";
import { type ChapterId, chapterNumber, type LandingContent, type TextKey } from "@/lib/content";
import { RichText } from "../RichText";

/**
 * Shared pieces of the comic chapters (server components).
 * Chapter numbers come from CHAPTER_ORDER (src/lib/content/registry.ts), so labels, folios
 * and the menu always follow the actual order of the sections.
 */

type Texts = LandingContent["texts"];

/** «Глава 02 · О нас» — the word is a content block, the number is derived from the order. */
export function ChapterLabel({ chapter, texts, suffixKey }: { chapter: ChapterId; texts: Texts; suffixKey?: TextKey }): ReactElement {
  const suffix = suffixKey ? texts[suffixKey] : "";
  return (
    <span>
      <span data-edit="common.chapter">{texts["common.chapter"]}</span> {chapterNumber(chapter)}
      {suffix && suffixKey ? (
        <>
          {" · "}
          <span data-edit={suffixKey}>{suffix}</span>
        </>
      ) : null}
    </span>
  );
}

type ChapterHeaderProps = {
  chapter: ChapterId;
  texts: Texts;
  titleKey: TextKey;
  narrationKey: TextKey;
  suffixKey?: TextKey;
  headingId: string;
};

/** Chapter opening: «Глава NN», the inked title (with the hatched offset shadow), the narration plate. */
export function ChapterHeader({ chapter, texts, titleKey, narrationKey, suffixKey, headingId }: ChapterHeaderProps): ReactElement {
  const title = texts[titleKey];
  const narration = texts[narrationKey];
  return (
    <header className="chapter">
      <span className="chapter__sheet" aria-hidden="true" />
      <p className="chapter__no">
        <ChapterLabel chapter={chapter} texts={texts} suffixKey={suffixKey} />
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

/** «— 02 —» at the bottom of a chapter page. */
export function Folio({ chapter, paper = false }: { chapter: ChapterId; paper?: boolean }): ReactElement {
  return (
    <span className={paper ? "folio folio--paper" : "folio"} aria-hidden="true">
      — {chapterNumber(chapter)} —
    </span>
  );
}

const ARROWS = /([←→])/;

/**
 * CMS text with its arrows (← →) set in the system UI face, as in the concept: Tektur has no
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
 * Designed empty state: a dashed, inked frame with a hand-lettered text from the CMS. Rendered
 * as RichText, so a RICHTEXT block (news.text) keeps the paragraphs the admin separated.
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
