'use client';

import { type ReactElement, useRef } from 'react';

import { chapterReveal, panelWipes, sfxPop } from '../motion/effects';
import { useScene } from '../motion/useScene';
import { SceneRoot, type SceneProps } from './SceneRoot';

/**
 * «О нас»: chapter header, ink-wipe panels, «ТССС!». The close-up snake flicking its tongue is
 * CSS (noir.css «tongue flick»: a compositor animation, paused off screen — offscreen-loops.ts).
 */
export function AboutScene(props: SceneProps): ReactElement {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, (root, ctx) => {
    chapterReveal(root);
    panelWipes(root, ctx);
    sfxPop(root);
  });
  return <SceneRoot sceneRef={ref} {...props} />;
}
