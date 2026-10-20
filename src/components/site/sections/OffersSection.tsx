import type { Locale } from '@/i18n/locales';
import type { LandingContent, OfferView } from '@/lib/content';
import { SECTION_ANCHORS, chapterNumber } from '@/lib/content';
import { leadSubject } from '@/lib/leads';

import type { ReactElement } from 'react';

import { ContentImage } from '../ContentImage';
import { formatDate, pad2 } from '../format';
import { aspectOf, stampSizes } from '../layout-rules';
import { leadLinkProps, localizeSiteHref, offerCta } from '../lead-links';
import { formatNodes, formatText } from '../message-template';
import { RichText } from '../RichText';
import { OffersScene } from '../scenes/OffersScene';
import { ChapterHeader, EmptyState, Folio } from './parts';

/** Copies of the wordmark on the noir red tape (CSS marquee). */
const TAPE_WORDS = 20;
/** Badges longer than this are set smaller, so «Подарок» still fits the coupon. */
const SHORT_BADGE = 5;

function CouponButton({
  offer,
  subjectTemplate,
  newTabHint,
  locale,
}: {
  offer: OfferView;
  /** offers.subject: «Купон: {offer}». */
  subjectTemplate: string;
  /** common.opensInNewTab (screen-reader hint of a link that opens in a new tab). */
  newTabHint: string;
  locale: Locale;
}): ReactElement {
  const target = offerCta(offer.ctaHref);
  const label = (
    <>
      <span data-field="ctaLabel">{offer.ctaLabel}</span>{' '}
      <span className="glyph" aria-hidden="true">
        →
      </span>
    </>
  );
  if (target.kind === 'form') {
    return (
      <a
        className="link-btn link-btn--paper"
        {...leadLinkProps(
          {
            type: target.type,
            subject: leadSubject(formatText(subjectTemplate, locale, { offer: offer.title }), offer.title),
          },
          '',
        )}
      >
        {label}
      </a>
    );
  }
  if (target.external) {
    return (
      <a className="link-btn link-btn--paper" href={target.href} target="_blank" rel="noopener noreferrer">
        {label}
        {newTabHint ? <span className="sr-only"> {newTabHint}</span> : null}
      </a>
    );
  }
  return (
    <a className="link-btn link-btn--paper" href={localizeSiteHref(target.href, locale)}>
      {label}
    </a>
  );
}

/**
 * Глава 04 · Специальные предложения: the noir red tape, then each published offer as a
 * cut-out coupon. A coupon button leads to the form (topic from its link, the offer as the
 * subject) or to its own link.
 */
export function OffersSection({ content }: { content: LandingContent }): ReactElement {
  const { texts, offers, locale } = content;
  return (
    <OffersScene id={SECTION_ANCHORS.offers} className="page" labelledBy="offers-title" folio={chapterNumber('offers')}>
      <div className="tape-wrap" aria-hidden="true">
        <div className="tape">
          <div className="tape__track">
            {Array.from({ length: TAPE_WORDS }, (_, index) => (
              <span key={index} className="tape__word mask-img m-wordmark" />
            ))}
          </div>
        </div>
      </div>
      <div className="wrap">
        <ChapterHeader
          chapter="offers"
          texts={texts}
          locale={locale}
          titleKey="offers.title"
          narrationKey="offers.narration"
          headingId="offers-title"
        />
        <RichText text={texts['offers.text']} editKey="offers.text" className="lead lead--wide" reveal />

        {offers.length > 0 ? (
          <ul className="coupons">
            {offers.map((offer, index) => (
              <li key={offer.id} className="coupon" data-entity="Offer" data-entity-id={offer.id}>
                <span className="coupon__cut" aria-hidden="true">
                  ✂
                </span>
                {offer.image ? (
                  <span className="coupon__stamp">
                    <ContentImage image={offer.image} sizes={stampSizes(aspectOf(offer.image))} />
                  </span>
                ) : null}
                <p className="coupon__kicker" data-edit="offers.couponNo">
                  {formatText(texts['offers.couponNo'], locale, { number: pad2(index + 1) })}
                </p>
                {offer.badge ? (
                  <p
                    className="coupon__big"
                    data-field="badge"
                    data-size={offer.badge.length > SHORT_BADGE ? 'long' : undefined}
                  >
                    {offer.badge}
                  </p>
                ) : null}
                <h3 className="coupon__title" data-field="title">
                  {offer.title}
                </h3>
                <RichText text={offer.text} className="coupon__text" />
                {offer.validUntil ? (
                  <p className="coupon__until" data-edit="offers.validUntil">
                    {formatNodes(texts['offers.validUntil'], locale, {
                      date: (
                        <time dateTime={offer.validUntil} data-field="validUntil">
                          {formatDate(offer.validUntil, locale)}
                        </time>
                      ),
                    })}
                  </p>
                ) : null}
                {offer.ctaLabel ? (
                  <CouponButton
                    offer={offer}
                    subjectTemplate={texts['offers.subject']}
                    newTabHint={texts['common.opensInNewTab']}
                    locale={locale}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState text={texts['offers.empty']} editKey="offers.empty" />
        )}
        {texts['offers.fine'] ? (
          <p className="fine" data-edit="offers.fine">
            {texts['offers.fine']}
          </p>
        ) : null}
      </div>
      <Folio chapter="offers" />
    </OffersScene>
  );
}
