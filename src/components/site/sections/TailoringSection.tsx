import type { ReactElement } from "react";
import type { LandingContent, TextKey } from "@/lib/content";
import { SECTION_ANCHORS, chapterNumber } from "@/lib/content";
import { ContentImage } from "../ContentImage";
import { pad2 } from "../format";
import { PICTURE_SLOTS, aspectOf, coverSizes } from "../layout-rules";
import { leadLinkProps } from "../lead-links";
import { RichText } from "../RichText";
import { ChapterScene } from "../scenes/ChapterScene";
import { ChapterHeader, Folio } from "./parts";

const STEPS: ReadonlyArray<{ title: TextKey; text: TextKey; className: string }> = [
  { title: "tailoring.steps.0.title", text: "tailoring.steps.0.text", className: "panel panel--blue step scales" },
  { title: "tailoring.steps.1.title", text: "tailoring.steps.1.text", className: "panel panel--paper step" },
  { title: "tailoring.steps.2.title", text: "tailoring.steps.2.text", className: "panel panel--ink step hatch" },
];

/** Глава 03 · Индивидуальный пошив: the pattern-rack photo («ЧИК!»), text + «Оставить заявку» (form, topic «пошив»), three steps. */
export function TailoringSection({ content }: { content: LandingContent }): ReactElement {
  const { texts, images } = content;
  return (
    <ChapterScene id={SECTION_ANCHORS.tailoring} className="page" labelledBy="tailoring-title" folio={chapterNumber("tailoring")}>
      <div className="wrap">
        <ChapterHeader
          chapter="tailoring"
          texts={texts}
          titleKey="tailoring.title"
          narrationKey="tailoring.narration"
          headingId="tailoring-title"
        />

        <div className="grid grid--tailor">
          <figure className="panel panel--media t-photo" data-wipe="diag">
            <div className="media halftone halftone--soft">
              <ContentImage
                image={images["tailoring.image"]}
                editKey="tailoring.image"
                sizes={coverSizes(aspectOf(images["tailoring.image"]), PICTURE_SLOTS.tailoringPhoto)}
              />
            </div>
            {texts["tailoring.imageCaption"] ? (
              <figcaption className="caption caption--paper panel__cap" data-edit="tailoring.imageCaption">
                {texts["tailoring.imageCaption"]}
              </figcaption>
            ) : null}
            {texts["tailoring.sfx"] ? (
              <span className="sfx sfx--snip" aria-hidden="true" data-edit="tailoring.sfx">
                {texts["tailoring.sfx"]}
              </span>
            ) : null}
          </figure>

          <div className="panel panel--ink t-text" data-wipe="left">
            <span className="t-text__art mask-img m-head-front" aria-hidden="true" />
            {texts["tailoring.subtitle"] ? (
              <h3 className="intro__title" data-edit="tailoring.subtitle">
                {texts["tailoring.subtitle"]}
              </h3>
            ) : null}
            <RichText text={texts["tailoring.text"]} editKey="tailoring.text" className="lead" />
            <a className="btn btn--red" {...leadLinkProps({ type: "TAILORING", subject: "" }, "")}>
              <span className="btn__face" data-edit="tailoring.cta">
                {texts["tailoring.cta"]}
              </span>
            </a>
          </div>

          {STEPS.map((step, index) => (
            <article key={step.title} className={step.className} data-wipe="up">
              <span className="step__no" aria-hidden="true">
                {pad2(index + 1)}
              </span>
              <h3 className="step__title" data-edit={step.title}>
                {texts[step.title]}
              </h3>
              <RichText text={texts[step.text]} editKey={step.text} />
            </article>
          ))}
        </div>
      </div>
      <Folio chapter="tailoring" />
    </ChapterScene>
  );
}
