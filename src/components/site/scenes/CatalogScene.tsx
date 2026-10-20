'use client';

import { type ReactElement, useRef } from 'react';

import { chapterReveal, coverTilt, dropIn, litWhenCentred, panelWipes } from '../motion/effects';
import { useScene } from '../motion/useScene';
import { SceneRoot, type SceneProps } from './SceneRoot';

/**
 * «Каталог» (landing chapter and the collection page): chapter header, ink-wipe panels,
 * product covers fall onto the table, tilt under the mouse, and get their colour back when
 * centred on touch screens.
 */
export function CatalogScene(props: SceneProps): ReactElement {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, (root, ctx) => {
    chapterReveal(root);
    panelWipes(root, ctx);
    dropIn(
      root,
      ctx,
      '.cover',
      { y: 90, rotation: 4, opacity: 0 },
      { y: 0, rotation: 0, opacity: 1, duration: 1.1, stagger: 0.12, ease: 'power3.out' },
      'all',
    );
    coverTilt(root, ctx);
    litWhenCentred(root, '.cover__card', 'top 70%', 'bottom 30%');
  });
  return <SceneRoot sceneRef={ref} {...props} />;
}
