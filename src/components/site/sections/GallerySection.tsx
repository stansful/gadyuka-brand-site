import { getMessages } from "next-intl/server";
import type { ReactElement } from "react";
import type { LandingContent } from "@/lib/content";
import { SECTION_ANCHORS, chapterNumber } from "@/lib/content";
import { pad2 } from "../format";
import { imgAttrs } from "../image-props";
import { fill } from "../labels";
import { aspectOf, coverSizes, galleryLayout } from "../layout-rules";
import { RichText } from "../RichText";
import { GalleryGrid, type GalleryPicture, GalleryScene } from "../scenes/GalleryScene";
import { ChapterHeader, EmptyState, Folio } from "./parts";

/** Глава 06 · Галерея — «evidence photos» printed in ink (colour on hover), opened in a lightbox. */
export async function GallerySection({ content }: { content: LandingContent }): Promise<ReactElement> {
  const { texts, gallery } = content;
  const { common } = await getMessages();
  const cells = galleryLayout(gallery.length);
  // The pictures' attributes are computed here (next/image output): the grid renders plain <img>
  // (no next/image client component); the viewer derives its larger variant from them.
  const pictures: GalleryPicture[] = gallery.flatMap((item, i) => {
    const cell = cells[i];
    if (!cell) return [];
    /** A gallery link is never nameless: its media alt, its caption, or «Фото 03». */
    const alt = item.image.alt || item.caption || item.image.altDefault || fill(common.galleryPhoto, { number: pad2(i + 1) });
    const { src, width, height } = item.image;
    return [
      {
        id: item.id,
        href: src,
        caption: item.caption,
        cell: { slot: cell.slot, full: cell.full, tall: cell.tall, wipe: cell.wipe },
        thumb: imgAttrs({ src, width, height, alt, sizes: coverSizes(aspectOf(item.image), cell.slots) }),
      },
    ];
  });
  return (
    <GalleryScene id={SECTION_ANCHORS.gallery} className="page" labelledBy="gallery-title" folio={chapterNumber("gallery")}>
      <div className="wrap">
        <ChapterHeader chapter="gallery" texts={texts} titleKey="gallery.title" narrationKey="gallery.narration" headingId="gallery-title" />
        <RichText text={texts["gallery.text"]} editKey="gallery.text" className="lead lead--wide" reveal />
        <GalleryGrid
          pictures={pictures}
          labels={{ imageViewer: common.imageViewer, previousImage: common.previousImage, nextImage: common.nextImage, closeViewer: common.closeViewer }}
          empty={<EmptyState text={texts["gallery.empty"]} editKey="gallery.empty" />}
        />
      </div>
      <Folio chapter="gallery" />
    </GalleryScene>
  );
}
