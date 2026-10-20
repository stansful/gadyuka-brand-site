import type { ReactElement } from "react";
import type { LandingContent, TextKey } from "@/lib/content";
import { SECTION_ANCHORS, chapterNumber } from "@/lib/content";
import { ContentImage } from "../ContentImage";
import { pad2 } from "../format";
import { PICTURE_SLOTS, aspectOf, coverSizes } from "../layout-rules";
import { RichText } from "../RichText";
import { AboutScene } from "../scenes/AboutScene";
import { ChapterHeader, Folio } from "./parts";

const ADVANTAGES: ReadonlyArray<{ title: TextKey; text: TextKey; className: string }> = [
  { title: "about.advantages.0.title", text: "about.advantages.0.text", className: "panel panel--paper point" },
  { title: "about.advantages.1.title", text: "about.advantages.1.text", className: "panel panel--ink point hatch" },
  { title: "about.advantages.2.title", text: "about.advantages.2.text", className: "panel panel--blue point scales" },
];

/**
 * Глава 02 · О нас — «Преимущества бренда Гадюка»: photo panel, text + «Отзывы покупателей» and
 * «Партнёры бренда», three advantages, the snake close-up.
 */
export function AboutSection({ content }: { content: LandingContent }): ReactElement {
  const { texts, images } = content;
  return (
    <AboutScene id={SECTION_ANCHORS.about} className="page" labelledBy="about-title" folio={chapterNumber("about")}>
      <div className="wrap">
        <ChapterHeader
          chapter="about"
          texts={texts}
          titleKey="about.title"
          narrationKey="about.narration"
          suffixKey="about.label"
          headingId="about-title"
        />

        <div className="grid grid--about">
          <figure className="panel panel--media a-photo" data-wipe="diag">
            <div className="media halftone">
              <ContentImage
                image={images["about.image"]}
                editKey="about.image"
                sizes={coverSizes(aspectOf(images["about.image"]), PICTURE_SLOTS.aboutPhoto)}
              />
            </div>
            {texts["about.imageCaption"] ? (
              <figcaption className="caption caption--paper panel__cap" data-edit="about.imageCaption">
                {texts["about.imageCaption"]}
              </figcaption>
            ) : null}
            {texts["about.sfx"] ? (
              <span className="sfx sfx--tss" aria-hidden="true" data-edit="about.sfx">
                {texts["about.sfx"]}
              </span>
            ) : null}
          </figure>

          <div className="panel panel--ink a-text" data-wipe="left">
            <RichText text={texts["about.text"]} editKey="about.text" className="lead" />
            {/* «Партнёры бренда» has no menu item: this is the way to that chapter from «О нас». */}
            <div className="btn-row">
              <a className="btn btn--blue" href={`#${SECTION_ANCHORS.reviews}`}>
                <span className="btn__face">
                  <span data-edit="about.cta">{texts["about.cta"]}</span> <span aria-hidden="true">↓</span>
                </span>
              </a>
              <a className="btn btn--blue" href={`#${SECTION_ANCHORS.partners}`}>
                <span className="btn__face">
                  <span data-edit="about.partnersCta">{texts["about.partnersCta"]}</span> <span aria-hidden="true">↓</span>
                </span>
              </a>
            </div>
          </div>

          {ADVANTAGES.map((item, index) => (
            <article key={item.title} className={item.className} data-wipe="up">
              <span className="point__no" aria-hidden="true">
                {pad2(index + 1)}
              </span>
              <h3 className="point__title" data-edit={item.title}>
                {texts[item.title]}
              </h3>
              <p data-edit={item.text}>{texts[item.text]}</p>
            </article>
          ))}

          <figure className="panel panel--paper closeup" data-wipe="right">
            <div className="closeup__art" aria-hidden="true">
              <span className="closeup__ink mask-img m-closeup-ink" />
              <span className="closeup__tongue mask-img m-closeup-red" />
            </div>
            {texts["about.closeupCaption"] ? (
              <figcaption className="caption caption--ink closeup__cap" data-edit="about.closeupCaption">
                {texts["about.closeupCaption"]}
              </figcaption>
            ) : null}
          </figure>
        </div>
      </div>
      <Folio chapter="about" />
    </AboutScene>
  );
}
