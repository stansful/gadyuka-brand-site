import type { CSSProperties, ReactNode } from "react";

/**
 * Server-side helper of the cover intro, which runs in CSS from the first paint (noir.css,
 * «COVER INTRO»): the staggered pieces get their index as a CSS custom property.
 */

/** Custom properties the intro keyframes read (--i: stagger index, --n: char count, --at: start). */
export type IntroVars = CSSProperties & Partial<Record<"--i" | "--n" | "--at", string | number>>;

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const WHITESPACE = /^\s+$/;

/**
 * The text as one inline <span style="--i:n"> per visible character, for the intro to stagger
 * (typed captions, the slogan). Whitespace stays plain text and is not counted — the same
 * chars GSAP's SplitText animated. Inline spans keep the text's shaping (kerning,
 * letter-spacing), and the element's textContent is unchanged (no duplicate copy for AT).
 */
export function introChars(text: string): { chars: ReactNode[]; count: number } {
  const chars: ReactNode[] = [];
  let count = 0;
  let space = "";
  for (const { segment } of graphemes.segment(text)) {
    if (WHITESPACE.test(segment)) {
      space += segment;
      continue;
    }
    if (space) {
      chars.push(space);
      space = "";
    }
    const style: IntroVars = { "--i": count };
    chars.push(
      <span key={count} style={style}>
        {segment}
      </span>,
    );
    count += 1;
  }
  if (space) chars.push(space);
  return { chars, count };
}
