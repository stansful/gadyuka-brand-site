import type { ReactElement } from "react";
import type { LandingContent } from "@/lib/content";
import { SECTION_ANCHORS } from "@/lib/content";
import { brandAssetUrl } from "@/lib/media-url";
import { collectionPath, localizedPath } from "@/lib/seo/site-url";
import { WordmarkLetters } from "../brand/BrandDefs";
import { DripPath } from "../scenes/DripPath";
import { HeroScene } from "../scenes/HeroScene";
import { introChars, type IntroVars } from "./intro-text";
import { WithGlyphs } from "./parts";

/** The logo's potrace group (fill="currentColor"), referenced from the static file. */
const LOGO_INK = `${brandAssetUrl("logo-red-tongue-ink.svg")}#ink`;
/**
 * The tongue's whole silhouette (its ink is only the outline), in the same user space, painted
 * in the colour of the <use> (scripts/trace-tongue-fill.mjs).
 */
const TONGUE_FILL = `${brandAssetUrl("logo-red-tongue-fill.svg")}#fill`;

/** Intro clock (s): the first narration caption is typed from here, the next 0.5 s later. */
const CAPTION_AT = 1.7;
const CAPTION_STEP = 0.5;

/** Tongue region of the logo (SVG user space of logo-red-tongue-ink.svg, viewBox 0 0 1360 2440; scripts/trace-tongue-fill.mjs keeps a copy). */
const TONGUE_POLYGON =
  "586,288 586,339 545,345 476,351 420,358 388,372 366,392 350,418 332,448 300,482 258,503 210,512 186,505 186,398 230,397 270,391 300,377 325,357 345,340 372,326 400,318 444,313 500,311 548,304";
/** The tongue's root in the mouth (static) is drawn from here to the right: 3 units under the polygon's edge (x 586). */
const TONGUE_ROOT_X = 583;
/**
 * The tongue's own layer: the box around the polygon with room for the flick (scaleX 1.06,
 * ±5° about 586 314), in the same user space as the logo. Its CSS box (noir.css .snake-tongue)
 * is this rectangle as a share of the logo's viewBox (90 40 1230 2370).
 */
const TONGUE_BOX = "130 250 470 310";

/**
 * Главная — the comic cover. Brandbook image №1 (the wordmark on black, with the snake coiled
 * around «Г») is rebuilt from the brand vectors, and the whole cover is the link to «О нас».
 * The accessible name of the link is the H1 + the hint (both visible to sighted users too).
 * The bottom-right plate («Коллекция «Меня запомнят» →») is a link of its own, to the page of
 * the current collection (the first published one, as in the catalog): links cannot nest, so it
 * is the cover link's sibling, laid over it (.splash-wrap). Without a published collection it
 * stays a plain caption on the cover.
 *
 * The cover is complete in the server HTML; its intro (frame inked, snake dripped in, band and
 * wordmark stamped, captions typed …) is CSS that starts with the first paint under
 * html.motion.is-intro — the slogan and the captions come split into chars for it (introChars).
 */
export function HeroSection({ content }: { content: LandingContent }): ReactElement {
  const { texts, collections, locale } = content;
  const slogan = introChars(texts["hero.slogan"]);
  const collection = collections[0];
  const collectionHref = collection ? localizedPath(locale, collectionPath(collection.slug)) : null;
  // The narration captions are typed one after another (intro clock: --at), char by char; the
  // plate that is a link ends with an arrow, typed in as its last char.
  const captions = (["hero.captionTop", "hero.captionBottom"] as const)
    .filter((key) => texts[key])
    .map((key, index) => {
      const { chars, count } = introChars(texts[key]);
      const arrow = key === "hero.captionBottom" && collectionHref !== null;
      const style: IntroVars = { "--at": `${CAPTION_AT + index * CAPTION_STEP}s`, "--n": arrow ? count + 1 : count };
      const arrowStyle: IntroVars = { "--i": count };
      return { key, chars, style, arrowStyle };
    });
  const caption = (key: (typeof captions)[number]["key"], modifier: string): ReactElement | null => {
    const found = captions.find((item) => item.key === key);
    return found ? (
      <span className={`caption caption--paper splash__cap ${modifier}`} data-edit={key} style={found.style}>
        {found.chars}
      </span>
    ) : null;
  };
  const collectionPlate = captions.find((item) => item.key === "hero.captionBottom");
  return (
    <HeroScene className="hero" id={SECTION_ANCHORS.hero} labelledBy="hero-title">
      <div className="splash-wrap">
        <a className="splash" href={`#${SECTION_ANCHORS.about}`} aria-labelledby="hero-title hero-hint">
          <span className="splash__bg" aria-hidden="true" />
          <span className="splash__rain" aria-hidden="true" />
          <svg className="splash__frame" aria-hidden="true" focusable="false">
            <rect className="splash__rect" x="0" y="0" width="100%" height="100%" />
          </svg>

          <span className="splash__snake" aria-hidden="true">
            {/* The logo's paths come from the same cached file the header mark and the menu use
                (an external <use>): the white body, the tongue repainted red over its solid red
                silhouette (another small cached file), the ink-drip mask. The tongue is drawn on a
                small <svg> of its own over the logo: its flick is a compositor animation of that
                layer (noir.css «tongue flick») — inside the logo's <svg> every frame of it
                repainted the whole logo. */}
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
                <clipPath id="c-tongue-root">
                  <rect x={TONGUE_ROOT_X} y="280" width="40" height="70" />
                </clipPath>
              </defs>
              {/* the reveal mask applies during the intro only (noir.css, .motion.is-intro) */}
              <g className="snake__all">
                {/* the tongue's root in the mouth, under the white ink: it stays while the tongue
                    shoots out and flicks, and reaches a little under the tongue (no seam between them) */}
                <use className="snake__root" href={TONGUE_FILL} clipPath="url(#c-tongue-root)" />
                <g className="snake__body" mask="url(#m-notongue)">
                  <g id="snake-ink" className="snake__ink">
                    <use href={LOGO_INK} />
                  </g>
                </g>
              </g>
            </svg>
            <svg className="snake-tongue" viewBox={TONGUE_BOX} focusable="false">
              {/* the same drip mask as the logo during the intro (noir.css) */}
              <g className="snake__all">
                {/* solid red tongue: the silhouette under the outline, one group — the intro and the flick move both */}
                <g className="snake__tongue" clipPath="url(#c-tongue)">
                  <use href={TONGUE_FILL} />
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
          {collectionHref ? null : caption("hero.captionBottom", "splash__cap--br")}

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
        {collectionHref && collectionPlate ? (
          <a
            className="caption caption--paper splash__cap splash__cap--br splash__cta"
            href={collectionHref}
            data-edit="hero.captionBottom"
            style={collectionPlate.style}
          >
            {collectionPlate.chars}
            <span className="glyph splash__go" aria-hidden="true" style={collectionPlate.arrowStyle}>
              →
            </span>
          </a>
        ) : null}
      </div>
    </HeroScene>
  );
}
