import type { ReactElement } from "react";
import type { LandingContent } from "@/lib/content";
import { SECTION_ANCHORS } from "@/lib/content";
import { brandAssetUrl } from "@/lib/media-url";
import { WordmarkLetters } from "../brand/BrandDefs";
import { DripPath } from "../scenes/DripPath";
import { HeroScene } from "../scenes/HeroScene";
import { introChars, type IntroVars } from "./intro-text";
import { WithGlyphs } from "./parts";

/** The logo's potrace group (fill="currentColor"), referenced from the static file. */
const LOGO_INK = `${brandAssetUrl("logo-red-tongue-ink.svg")}#ink`;

/** Intro clock (s): the first narration caption is typed from here, the next 0.5 s later. */
const CAPTION_AT = 1.7;
const CAPTION_STEP = 0.5;

/** Tongue region of the logo (SVG user space of logo-red-tongue-ink.svg, viewBox 0 0 1360 2440). */
const TONGUE_POLYGON =
  "586,288 586,339 545,345 476,351 420,358 388,372 366,392 350,418 332,448 300,482 258,503 210,512 186,505 186,398 230,397 270,391 300,377 325,357 345,340 372,326 400,318 444,313 500,311 548,304";

/**
 * Главная — the comic cover. Brandbook image №1 (the wordmark on black, with the snake coiled
 * around «Г») is rebuilt from the brand vectors, and the whole cover is the link to «О нас».
 * The accessible name of the link is the H1 + the hint (both visible to sighted users too).
 *
 * The cover is complete in the server HTML; its intro (frame inked, snake dripped in, band and
 * wordmark stamped, captions typed …) is CSS that starts with the first paint under
 * html.motion.is-intro — the slogan and the captions come split into chars for it (introChars).
 */
export function HeroSection({ content }: { content: LandingContent }): ReactElement {
  const { texts } = content;
  const slogan = introChars(texts["hero.slogan"]);
  // The narration captions are typed one after another (intro clock: --at), char by char.
  const captions = (["hero.captionTop", "hero.captionBottom"] as const)
    .filter((key) => texts[key])
    .map((key, index) => {
      const { chars, count } = introChars(texts[key]);
      const style: IntroVars = { "--at": `${CAPTION_AT + index * CAPTION_STEP}s`, "--n": count };
      return { key, chars, style };
    });
  const caption = (key: (typeof captions)[number]["key"], modifier: string): ReactElement | null => {
    const found = captions.find((item) => item.key === key);
    return found ? (
      <span className={`caption caption--paper splash__cap ${modifier}`} data-edit={key} style={found.style}>
        {found.chars}
      </span>
    ) : null;
  };
  return (
    <HeroScene className="hero" id={SECTION_ANCHORS.hero} labelledBy="hero-title">
      <a className="splash" href={`#${SECTION_ANCHORS.about}`} aria-labelledby="hero-title hero-hint">
        <span className="splash__bg" aria-hidden="true" />
        <span className="splash__rain" aria-hidden="true" />
        <svg className="splash__frame" aria-hidden="true" focusable="false">
          <rect className="splash__rect" x="0" y="0" width="100%" height="100%" />
        </svg>

        <span className="splash__snake" aria-hidden="true">
          {/* The logo's paths come from the same cached file the header mark and the menu use
              (an external <use>): the white body, the tongue repainted red, the ink-drip mask. */}
          <svg className="snake" viewBox="90 40 1230 2370" focusable="false">
            <defs>
              <mask id="m-reveal" maskUnits="userSpaceOnUse" x="-100" y="-100" width="1560" height="2700">
                <g className="snake__drip" transform="translate(0 2700)">
                  <DripPath />
                </g>
              </mask>
              <mask id="m-notongue" maskUnits="userSpaceOnUse" x="-100" y="-100" width="1560" height="2700">
                <rect x="-100" y="-100" width="1560" height="2700" fill="#fff" />
                <polygon fill="#000" points={TONGUE_POLYGON} />
              </mask>
              <clipPath id="c-tongue">
                <polygon points={TONGUE_POLYGON} />
              </clipPath>
            </defs>
            {/* the reveal mask applies during the intro only (noir.css, .motion.is-intro) */}
            <g className="snake__all">
              <g className="snake__body" mask="url(#m-notongue)">
                <g id="snake-ink" className="snake__ink">
                  <use href={LOGO_INK} />
                </g>
              </g>
              <g className="snake__tongue" clipPath="url(#c-tongue)">
                <use href="#snake-ink" />
              </g>
            </g>
          </svg>
        </span>

        <span className="splash__band">
          <span className="splash__band-line" aria-hidden="true" />
          <h1 className="splash__title" id="hero-title">
            <span className="sr-only">
              <span data-edit="hero.title">{texts["hero.title"]}</span>
              {texts["hero.subtitle"] ? (
                <>
                  {" — "}
                  <span data-edit="hero.subtitle">{texts["hero.subtitle"]}</span>
                </>
              ) : null}
            </span>
            <span className="wordmark" aria-hidden="true">
              <WordmarkLetters />
            </span>
          </h1>
          <span className="splash__slogan" data-edit="hero.slogan">
            {slogan.chars}
          </span>
          <span className="splash__band-line splash__band-line--b" aria-hidden="true" />
        </span>

        {caption("hero.captionTop", "splash__cap--tl")}
        {caption("hero.captionBottom", "splash__cap--br")}

        <span className="splash__corner" aria-hidden="true">
          <b data-edit="hero.issue">{texts["hero.issue"]}</b>
          <span data-edit="hero.issueMeta">{texts["hero.issueMeta"]}</span>
        </span>

        {texts["hero.sfx"] ? (
          <span className="sfx sfx--hiss" aria-hidden="true" data-edit="hero.sfx">
            {texts["hero.sfx"]}
          </span>
        ) : null}

        <span className="splash__hint" id="hero-hint">
          <span className="splash__hint-arrow" aria-hidden="true">
            ↓
          </span>
          <span data-edit="hero.hint">{texts["hero.hint"]}</span>
        </span>
        <span className="splash__cursor" aria-hidden="true" data-edit="hero.cursor">
          <WithGlyphs text={texts["hero.cursor"]} />
        </span>
      </a>
    </HeroScene>
  );
}
