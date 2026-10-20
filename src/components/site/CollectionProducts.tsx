import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/locales';
import type { CollectionView, ImageRef, LandingContent } from '@/lib/content';
import { leadSubject } from '@/lib/leads';

import type { ReactElement } from 'react';

import { ContentImage } from './ContentImage';
import { formatPrice, pad2 } from './format';
import { PICTURE_SLOTS, aspectOf, coverSizes } from './layout-rules';
import { leadLinkProps } from './lead-links';
import { RichText } from './RichText';

/** Fragment id of a product card (stable link target for JSON-LD and the admin). */
export function productAnchor(slug: string): string {
  return `product-${slug}`;
}

/** Landscape photos (e.g. the hoodie seen from the back) are framed whole instead of chest-cropped. */
function isWide(image: ImageRef | null): boolean {
  return image !== null && image.width / image.height > 1.45;
}

type CollectionProductsProps = {
  collection: CollectionView;
  texts: LandingContent['texts'];
  locale: Locale;
  /** "" on the landing (CTA → in-page form), the landing path ("/", "/en") elsewhere. */
  homePath: string;
  /** Heading level of product titles in the page outline. */
  productHeading: 'h2' | 'h4';
  /** Append the «next collection is in the works» card (after the last collection). */
  withSoon: boolean;
  /** Collection page: description, more photos and details under each cover. */
  detailed?: boolean;
};

/**
 * Products as comic-book covers (catalog.productNo: #01, #02 …): masthead with the wordmark, halftone noir art
 * that gets its colour back on hover, a price tag, title and the print line. «Заказать»
 * opens the lead form with the product as the subject. Shared by the landing catalog and the
 * collection page (src/app/[locale]/catalog/[slug]/page.tsx), which also shows the product's
 * other photos (each a link to the full picture, like the gallery without JS).
 */
export async function CollectionProducts({
  collection,
  texts,
  locale,
  homePath,
  productHeading,
  withSoon,
  detailed = false,
}: CollectionProductsProps): Promise<ReactElement> {
  const [t, tCatalog] = await Promise.all([
    getTranslations({ locale, namespace: 'common' }),
    getTranslations({ locale, namespace: 'catalog' }),
  ]);
  const Heading = productHeading;
  const { products } = collection;
  return (
    <ul className={detailed ? 'covers covers--page' : 'covers'} data-collection={collection.slug}>
      {products.map((product, index) => {
        const image = product.images[0] ?? null;
        const tag = product.details[0] ?? '';
        const order = leadLinkProps(
          {
            type: 'CONTACT',
            subject: leadSubject(tCatalog('orderSubject', { product: product.title }), product.title),
          },
          homePath,
        );
        return (
          <li
            key={product.id}
            id={productAnchor(product.slug)}
            className="cover"
            data-entity="Product"
            data-entity-id={product.id}
          >
            <article className="cover__card" data-tilt="">
              <div className="cover__mast">
                <span className="cover__brand mask-img m-wordmark" aria-hidden="true" />
                <span className="cover__issue" aria-hidden="true" data-edit="catalog.productNo">
                  {tCatalog('productNo', { number: pad2(index + 1) })}
                </span>
              </div>
              <div className={`cover__art media halftone noir${isWide(image) ? ' cover__art--wide' : ''}`}>
                <ContentImage
                  image={image}
                  sizes={coverSizes(aspectOf(image), isWide(image) ? PICTURE_SLOTS.coverWide : PICTURE_SLOTS.cover)}
                  fallbackAlt={product.title}
                />
              </div>
              {product.price !== null ? (
                <span className="cover__price">
                  <small data-edit="catalog.priceLabel">{texts['catalog.priceLabel']}</small>
                  <b data-field="price">{formatPrice(product.price, locale)}</b>
                </span>
              ) : (
                <span className="cover__price cover__price--request">
                  <b data-edit="catalog.priceOnRequest">{texts['catalog.priceOnRequest']}</b>
                </span>
              )}
              <div className="cover__foot">
                <Heading className="cover__title" data-field="title">
                  {product.title}
                </Heading>
                {tag ? (
                  <p className="cover__tag" data-field="details">
                    {tag}
                  </p>
                ) : product.description ? (
                  <p className="cover__tag" data-field="description">
                    {product.description}
                  </p>
                ) : null}
              </div>
            </article>

            {detailed ? (
              <div className="cover__more">
                {product.images.length > 1 ? (
                  <ul className="cover__thumbs">
                    {product.images.slice(1).map((photo, photoIndex) => (
                      <li key={photo.id}>
                        <a className="cover__thumb" href={photo.src}>
                          <ContentImage
                            image={photo}
                            sizes="80px"
                            fallbackAlt={t('productPhoto', { product: product.title, number: photoIndex + 2 })}
                          />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <RichText text={product.description} className="cover__desc" />
                {product.details.length > 0 ? (
                  <details className="cover__details">
                    <summary data-edit="catalog.detailsLabel">{texts['catalog.detailsLabel']}</summary>
                    <ul data-field="details">
                      {product.details.map((line, lineIndex) => (
                        <li key={lineIndex}>{line}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            ) : null}

            <a className="link-btn" {...order}>
              <span data-edit="catalog.orderCta">{texts['catalog.orderCta']}</span>{' '}
              <span className="glyph" aria-hidden="true">
                →
              </span>
            </a>
          </li>
        );
      })}

      {withSoon ? (
        <li className="cover cover--soon">
          <div className="cover__soon">
            {/* The next cover number continues the products; with no products there is nothing
                to continue (a lone «#01» would read like a collection number). */}
            {products.length > 0 ? (
              <span className="cover__soon-no" aria-hidden="true" data-edit="catalog.productNo">
                {tCatalog('productNo', { number: pad2(products.length + 1) })}
              </span>
            ) : null}
            <p className="cover__soon-title" data-edit="catalog.soonTitle">
              {texts['catalog.soonTitle']}
            </p>
            <p className="cover__soon-text" data-edit="catalog.soon">
              {texts['catalog.soon']}
            </p>
          </div>
        </li>
      ) : null}
    </ul>
  );
}
