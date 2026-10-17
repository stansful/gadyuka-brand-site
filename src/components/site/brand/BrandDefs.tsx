import type { CSSProperties, ReactElement } from "react";
import { WORDMARK_LETTERS, WORDMARK_TRANSFORM, WORDMARK_VIEWBOX } from "./wordmark-paths";

/**
 * Shared SVG defs, rendered once per page (in the [locale] layout):
 *  - #f-ink — the hand-inked displacement filter (header rule, cover frame, speech bubbles);
 *  - #wm0…#wm5 — the six letters of the «ГАДЮКА» wordmark, #wm — the whole word
 *    (hero stamp animation, the red band). The wordmark stays Cyrillic in every locale: it is the logo.
 */
export function BrandDefs(): ReactElement {
  return (
    <>
      <FallbackGlyphs />
      <svg className="defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <filter id="f-ink" x="-3%" y="-3%" width="106%" height="106%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={7} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={5} xChannelSelector="R" yChannelSelector="G" />
          </filter>
          {WORDMARK_LETTERS.map((d, index) => (
            <path key={index} id={`wm${index}`} transform={WORDMARK_TRANSFORM} d={d} />
          ))}
          <g id="wm">
            {WORDMARK_LETTERS.map((_, index) => (
              <use key={index} href={`#wm${index}`} />
            ))}
          </g>
        </defs>
      </svg>
    </>
  );
}

/**
 * Decorative glyphs of the design's text (ticker ✦, rating ★, coupon ✂, arrows →) are not in
 * the web fonts' subsets: the browser draws them with the metric-matched local fallback faces
 * ("Tektur Fallback" … from next/font), and loads such a face when it first lays out such a
 * glyph — then re-lays out every text of that family. Most chapters are laid out only when
 * they come near the screen (content-visibility), so that would happen late, mid-scroll. An
 * invisible sample in each family makes the first layout request them with the web fonts.
 */
function FallbackGlyphs(): ReactElement {
  return (
    <span className="glyph-warm" aria-hidden="true">
      <span>→★✦✂</span>
      <span>→★✦✂</span>
      <span>→★✦✂</span>
    </span>
  );
}

/** Stagger index of a letter for the cover intro's CSS (noir.css: `.wm-l` delay uses --i). */
type LetterStyle = CSSProperties & Record<"--i", number>;

const letterStyle = (index: number): LetterStyle => ({ "--i": index });

/** The wordmark as an inline SVG with one <g class="wm-l"> per letter (stamped in one by one). */
export function WordmarkLetters(): ReactElement {
  return (
    <svg viewBox={WORDMARK_VIEWBOX} focusable="false" aria-hidden="true">
      {WORDMARK_LETTERS.map((_, index) => (
        <g key={index} className="wm-l" style={letterStyle(index)}>
          <use href={`#wm${index}`} />
        </g>
      ))}
    </svg>
  );
}

/** The whole wordmark (one <use> of #wm) — the red band repeats it. */
export function WordmarkUse({ className }: { className?: string }): ReactElement {
  return (
    <svg className={className} viewBox={WORDMARK_VIEWBOX} focusable="false" aria-hidden="true">
      <use href="#wm" />
    </svg>
  );
}
