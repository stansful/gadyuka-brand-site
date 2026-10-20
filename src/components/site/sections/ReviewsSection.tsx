import { getTranslations } from 'next-intl/server';

import type { LandingContent } from '@/lib/content';
import { SECTION_ANCHORS, chapterNumber } from '@/lib/content';

import type { ReactElement } from 'react';

import { ContentImage } from '../ContentImage';
import { ratingStars } from '../format';
import { reviewPanels } from '../layout-rules';
import { RichText } from '../RichText';
import { ReviewsScene } from '../scenes/ReviewsScene';
import { ChapterHeader, EmptyState, Folio } from './parts';

/**
 * Глава 07 · Отзывы: a comic page of «witness» panels — hooded halftone figure, speech bubble
 * breaking the frame, the name plate with the rating (if the admin set one) on the star scale of
 * the settings (SiteSettings.reviewRatingMax).
 */
export async function ReviewsSection({ content }: { content: LandingContent }): Promise<ReactElement> {
  const { texts, reviews, locale, settings } = content;
  const t = await getTranslations({ locale, namespace: 'common' });
  const max = settings.reviewRatingMax;
  const panels = reviewPanels(reviews.length);
  return (
    <ReviewsScene
      id={SECTION_ANCHORS.reviews}
      className="page"
      labelledBy="reviews-title"
      folio={chapterNumber('reviews')}
    >
      <div className="wrap">
        <ChapterHeader
          chapter="reviews"
          texts={texts}
          locale={locale}
          titleKey="reviews.title"
          narrationKey="reviews.narration"
          headingId="reviews-title"
        />
        <RichText text={texts['reviews.text']} editKey="reviews.text" className="lead lead--wide" reveal />

        {reviews.length > 0 ? (
          <div className="talk">
            {reviews.map((review, index) => {
              const panel = panels[index];
              if (!panel) return null;
              const classes = [
                'say',
                `say--${panel.variant}`,
                'panel',
                panel.tone === 'blue' ? 'panel--blue' : 'panel--ink',
                panel.wide ? 'say--wide' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <figure key={review.id} className={classes} data-entity="Review" data-entity-id={review.id}>
                  <span className={`say__scene ${panel.texture}`} aria-hidden="true">
                    <span className="say__fig" />
                  </span>
                  <blockquote className="say__bubble">
                    <RichText text={review.text} field="text" />
                  </blockquote>
                  <figcaption className="say__who">
                    {review.avatar ? (
                      <ContentImage
                        image={review.avatar}
                        sizes="40px"
                        className="say__avatar"
                        fallbackAlt={review.author}
                      />
                    ) : null}
                    <span className="say__id">
                      <b data-field="author">{review.author}</b>
                      {review.role ? <span data-field="role">{review.role}</span> : null}
                      {review.rating ? (
                        <span className="say__rating" data-field="rating">
                          <span className="say__stars glyph" aria-hidden="true">
                            {ratingStars(review.rating, max)}
                          </span>
                          <span className="sr-only">{t('rating', { rating: review.rating, max })}</span>
                        </span>
                      ) : null}
                    </span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        ) : (
          <EmptyState text={texts['reviews.empty']} editKey="reviews.empty" />
        )}
      </div>
      <Folio chapter="reviews" />
    </ReviewsScene>
  );
}
