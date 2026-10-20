'use client';

import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { GalleryCell } from '../layout-rules';

import { pad2 } from '../format';
import { type ImgAttrs, lightboxImageStyle } from '../img-attrs';
import { fill, type GalleryLabels } from '../labels';
import { chapterReveal, genericReveals, litWhenCentred, panelWipes } from '../motion/effects';
import { motionEnabled } from '../motion/env';
import { gsap } from '../motion/gsap';
import { lockScroll } from '../motion/lenis-store';
import { useScene } from '../motion/useScene';
import { SceneRoot, type SceneProps } from './SceneRoot';

/** «Галерея» chapter scene: header, lead, «evidence photos» wiping in, colour on touch when centred. */
export function GalleryScene(props: SceneProps): ReactElement {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, (root, ctx) => {
    chapterReveal(root);
    genericReveals(root);
    panelWipes(root, ctx);
    litWhenCentred(root, '.gal__item', 'top 62%', 'bottom 38%');
  });
  return <SceneRoot sceneRef={ref} {...props} />;
}

const SWIPE_PX = 50;

/** One photo of the grid, prepared on the server (GallerySection): next/image's <img> attributes. */
export type GalleryPicture = {
  id: string;
  /** The full picture (the link works without JS). */
  href: string;
  caption: string;
  cell: Pick<GalleryCell, 'slot' | 'full' | 'tall' | 'wipe'>;
  thumb: ImgAttrs;
};

/** The opened picture: as wide as the viewport allows, at most 1240 px (noir.css .lb__img). */
const LIGHTBOX_SIZES = '(max-width: 1240px) 100vw, 1240px';
/**
 * next/image's srcset for LIGHTBOX_SIZES (smallest share 100vw) holds the candidates from the
 * first device size (640, next.config default deviceSizes) up; the thumbnail's holds the same
 * ones plus smaller.
 */
const LIGHTBOX_MIN_WIDTH = 640;

/**
 * The viewer's <img> attributes, as next/image builds them for LIGHTBOX_SIZES (same src, alt,
 * decoding; lazy) — derived from the thumbnail's instead of sent twice in the page payload.
 */
function lightboxAttrs(thumb: ImgAttrs): ImgAttrs {
  const candidates = (thumb.srcSet ?? '').split(', ').filter(Boolean);
  const wide = candidates.filter(
    candidate => Number.parseInt(candidate.slice(candidate.lastIndexOf(' ') + 1), 10) >= LIGHTBOX_MIN_WIDTH,
  );
  const width = thumb.width ?? 0;
  const height = thumb.height ?? 0;
  return {
    ...thumb,
    srcSet: wide.length > 0 ? wide.join(', ') : thumb.srcSet,
    sizes: LIGHTBOX_SIZES,
    loading: 'lazy',
    className: 'lb__img',
    style: { ...thumb.style, ...lightboxImageStyle(width, height) },
  };
}

/**
 * The photo grid (the concept's 8-panel page, repeated; incomplete pages close their rows)
 * and the lightbox: <dialog> with prev/next, ←/→ keys, Esc (native), swipe, a counter and
 * the caption; focus returns to the opened photo. Each photo is a link to the full image,
 * so without JS it still opens.
 */
export function GalleryGrid({
  pictures,
  labels,
  empty,
}: {
  pictures: GalleryPicture[];
  labels: GalleryLabels;
  empty: ReactNode;
}): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const swipeRef = useRef<number | null>(null);
  /** A drag just navigated: the click that follows it must not count as a backdrop click. */
  const swipedRef = useRef(false);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const count = pictures.length;
  const current = pictures[index];

  const show = (next: number, dir: number): void => {
    setIndex(((next % count) + count) % count);
    setDirection(dir);
  };

  // The new image is wiped in from the side it came from.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog?.open || !motionEnabled()) return;
    const ctx = gsap.context(() => {
      const from =
        direction > 0 ? 'inset(0% 0% 0% 100%)' : direction < 0 ? 'inset(0% 100% 0% 0%)' : 'inset(100% 0% 0% 0%)';
      if (imageRef.current) {
        gsap.fromTo(
          imageRef.current,
          { clipPath: from },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7, ease: 'power3.inOut', clearProps: 'clipPath' },
        );
      }
      if (captionRef.current)
        gsap.fromTo(captionRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.25 });
    });
    return () => ctx.revert();
  }, [index, direction]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = (): void => {
      lockScroll(false);
      openerRef.current?.focus({ preventScroll: true });
    };
    dialog.addEventListener('close', onClose);
    return () => {
      dialog.removeEventListener('close', onClose);
      if (dialog.open) lockScroll(false);
    };
  }, []);

  if (count === 0) return <>{empty}</>;

  const open = (event: MouseEvent<HTMLAnchorElement>, at: number): void => {
    const dialog = dialogRef.current;
    if (!dialog || typeof dialog.showModal !== 'function') return; // fall back to the link
    event.preventDefault();
    openerRef.current = event.currentTarget;
    show(at, 0);
    dialog.showModal();
    lockScroll(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>): void => {
    if (event.key === 'ArrowRight') show(index + 1, 1);
    if (event.key === 'ArrowLeft') show(index - 1, -1);
  };

  // Swipe: .lb has touch-action: pan-y pinch-zoom (noir.css), so a horizontal finger drag is
  // delivered as pointer events instead of being taken over by the browser (pointercancel).
  const onPointerDown = (event: PointerEvent<HTMLDialogElement>): void => {
    swipeRef.current = event.clientX;
    swipedRef.current = false;
  };
  const onPointerUp = (event: PointerEvent<HTMLDialogElement>): void => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (start === null) return;
    const dx = event.clientX - start;
    if (Math.abs(dx) > SWIPE_PX) {
      swipedRef.current = true;
      show(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    }
  };
  const onPointerCancel = (): void => {
    swipeRef.current = null;
  };

  const onBackdrop = (event: MouseEvent<HTMLDialogElement>): void => {
    if (swipedRef.current) {
      // the click generated by a mouse drag that ended on the backdrop
      swipedRef.current = false;
      return;
    }
    const target = event.target;
    if (target === dialogRef.current || (target instanceof HTMLElement && target.classList.contains('lb__in')))
      dialogRef.current?.close();
  };

  return (
    <>
      <ul className="gal">
        {pictures.map((picture, i) => {
          const { cell } = picture;
          const classes = [
            'gal__item',
            `g-${cell.slot}`,
            'panel',
            'panel--media',
            cell.full ? 'is-full' : '',
            cell.tall ? 'is-tall' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <li
              key={picture.id}
              className={classes}
              data-wipe={cell.wipe}
              data-entity="GalleryItem"
              data-entity-id={picture.id}
            >
              <a className="gal__btn media halftone" href={picture.href} onClick={event => open(event, i)}>
                {/* oxlint-disable-next-line nextjs/no-img-element -- next/image's attributes, computed on the server */}
                <img {...picture.thumb} alt={picture.thumb.alt} data-nimg="1" />
                <span className="gal__no" aria-hidden="true">
                  {pad2(i + 1)}
                </span>
              </a>
            </li>
          );
        })}
      </ul>

      <dialog
        ref={dialogRef}
        className="lb"
        aria-label={labels.imageViewer}
        data-lenis-prevent=""
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClick={onBackdrop}
      >
        <div className="lb__in">
          {current ? (
            <figure className="lb__fig">
              <div ref={imageRef}>
                {/* oxlint-disable-next-line nextjs/no-img-element -- next/image's attributes, computed on the server */}
                <img key={current.id} {...lightboxAttrs(current.thumb)} alt={current.thumb.alt} data-nimg="1" />
              </div>
              {current.caption ? (
                <figcaption ref={captionRef} className="lb__cap caption caption--paper" data-field="caption">
                  {current.caption}
                </figcaption>
              ) : null}
            </figure>
          ) : null}
          <p className="lb__count" aria-live="polite">
            {fill(labels.counter, { current: pad2(index + 1), total: pad2(count) })}
          </p>
          <button
            className="lb__btn lb__prev"
            type="button"
            aria-label={labels.previousImage}
            onClick={() => show(index - 1, -1)}
          >
            ←
          </button>
          <button
            className="lb__btn lb__next"
            type="button"
            aria-label={labels.nextImage}
            onClick={() => show(index + 1, 1)}
          >
            →
          </button>
          <button
            className="lb__btn lb__close"
            type="button"
            aria-label={labels.closeViewer}
            onClick={() => dialogRef.current?.close()}
          >
            ✕
          </button>
        </div>
      </dialog>
    </>
  );
}
