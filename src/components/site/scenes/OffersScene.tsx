'use client';

import { type ReactElement, useRef } from 'react';

import { chapterReveal, dropIn, genericReveals } from '../motion/effects';
import { useScene } from '../motion/useScene';
import { SceneRoot, type SceneProps } from './SceneRoot';

/** «Специальные предложения»: chapter header, then the coupons drop in, swinging. */
export function OffersScene(props: SceneProps): ReactElement {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, (root, ctx) => {
    chapterReveal(root);
    genericReveals(root);
    dropIn(
      root,
      ctx,
      '.coupon',
      { y: 120, rotation: (i: number) => (i % 2 ? 8 : -7), opacity: 0 },
      { y: 0, rotation: 0, opacity: 1, duration: 1.1, stagger: 0.14, ease: 'back.out(1.3)' },
      'transform,opacity',
      true,
    );
  });
  return <SceneRoot sceneRef={ref} {...props} />;
}
