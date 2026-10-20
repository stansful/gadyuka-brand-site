import type { Metadata } from "next";
import { Fragment, type ReactElement } from "react";
import { toLocale } from "@/i18n/locales";
import { CHAPTER_ORDER, type ChapterId, getLanding, type LandingContent, SECTION_ANCHORS } from "@/lib/content";
import { JsonLd } from "@/lib/seo/JsonLd";
import { landingJsonLd } from "@/lib/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";
import { INTRO_BOOT } from "@/components/site/motion/boot";
import { BootScript } from "@/components/site/motion/BootScript";
import { RedBand } from "@/components/site/scenes/RedBand";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { AboutSection } from "@/components/site/sections/AboutSection";
import { CatalogSection } from "@/components/site/sections/CatalogSection";
import { ContactsSection } from "@/components/site/sections/ContactsSection";
import { GallerySection } from "@/components/site/sections/GallerySection";
import { HeroSection } from "@/components/site/sections/HeroSection";
import { NewsSection } from "@/components/site/sections/NewsSection";
import { OffersSection } from "@/components/site/sections/OffersSection";
import { PartnersSection } from "@/components/site/sections/PartnersSection";
import { ReviewsSection } from "@/components/site/sections/ReviewsSection";
import { TailoringSection } from "@/components/site/sections/TailoringSection";

/**
 * The landing — design «Нуар-комикс» (concepts/01-noir-comic): a comic issue. The cover, then
 * the chapters in CHAPTER_ORDER (Каталог → О нас → [red «ГАДЮКА» band] → Индивидуальный пошив
 * → Специальные предложения → Новости → Галерея → Отзывы → Партнёры → Контакты). Everything visible comes from getLanding() (ContentBlocks +
 * entities); sections are server components, animations live in small client scenes.
 */

type ChapterComponent = (props: { content: LandingContent }) => ReactElement | Promise<ReactElement>;

const CHAPTERS: Readonly<Record<ChapterId, ChapterComponent>> = {
  catalog: CatalogSection,
  about: AboutSection,
  tailoring: TailoringSection,
  reviews: ReviewsSection,
  news: NewsSection,
  gallery: GallerySection,
  offers: OffersSection,
  partners: PartnersSection,
  contacts: ContactsSection,
};

/** The red band runs between «О нас» and «Индивидуальный пошив». */
const RED_BAND_AFTER: ChapterId = "about";

// SEO: title/description/OG from SiteSettings, canonical + hreflang (ru, en, x-default).
export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  return buildMetadata(toLocale((await params).locale), { path: "/" });
}

export default async function LandingPage({ params }: PageProps<"/[locale]">): Promise<ReactElement> {
  const locale = toLocale((await params).locale);
  const content = await getLanding(locale);

  return (
    <>
      {/* html.is-intro: the cover's intro plays in CSS from the first paint — only with html.motion. */}
      <BootScript code={INTRO_BOOT} />
      <SiteHeader content={content} />
      <main id="main" tabIndex={-1}>
        <HeroSection content={content} />
        {CHAPTER_ORDER.map((id) => {
          const Chapter = CHAPTERS[id];
          return (
            <Fragment key={id}>
              <Chapter content={content} />
              {id === RED_BAND_AFTER ? <RedBand navSection={SECTION_ANCHORS[RED_BAND_AFTER]} /> : null}
            </Fragment>
          );
        })}
      </main>
      <SiteFooter content={content} />
      <JsonLd data={landingJsonLd(content)} />
    </>
  );
}
